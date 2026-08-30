import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeIndianMobile } from '../_shared/phone.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const TABLE_BY_TYPE: Record<string, string> = {
  agent: 'agent_applications',
  builder: 'builder_applications',
  partner: 'partner_applications',
};

/**
 * Resolves the calling user from the user JWT and verifies they are an admin.
 * Throws a descriptive error (returned as HTTP 400 by the handler) when the
 * caller is missing, unauthenticated, or not an admin/super_admin. The caller's
 * role is read from profiles via the *anon* client so it reflects the real JWT
 * identity rather than trusting a client-supplied role.
 */
async function requireAdmin(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string | null
): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required: admin authorization header missing');
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await client.auth.getUser();
  if (userErr || !user) {
    throw new Error('Authentication invalid: could not resolve user from JWT');
  }
  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = profile?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    throw new Error('Forbidden: caller is not authorized to process applications');
  }
  return user.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Admin-gated endpoint: throttle per-IP to slow credential/abuse attacks.
    const rate = await checkRateLimit(
      createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } }),
      req,
      { endpoint: 'process-application', maxRequests: 20, windowSeconds: 60 }
    );
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: rate.status,
        headers: { ...corsHeaders, ...rate.headers, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (service role) — can bypass RLS for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse the request body ONCE
    const body = await req.json();
    const { application_id, type, action, remarks, new_stage, verification_state } = body;

    // Validate required fields early
    if (!application_id) throw new Error('application_id is required');
    if (!type || !TABLE_BY_TYPE[type]) throw new Error('Invalid application type');
    if (!action) throw new Error('action is required');

    // ─── MANDATORY ADMIN AUTH ───────────────────────────────────────────────
    // This function performs privileged, irreversible actions (approving an
    // application = creating real auth users via the service key; rejecting;
    // suspending/reactivating accounts). Previously the JWT check was best-effort
    // and non-blocking, so any caller with the anon key could invoke it.
    // Now we REQUIRE an authenticated caller whose profiles.role is an admin,
    // and reject everyone else before touching any data.
    const authHeader = req.headers.get('Authorization');
    const adminUserId = await requireAdmin(supabaseUrl, supabaseAnonKey, authHeader);

    console.log(`process-application: action=${action} type=${type} app=${application_id} admin=${adminUserId}`);

    const table = TABLE_BY_TYPE[type];

    // Helper: log activity without crashing the main operation
    const logActivity = async (actionLabel: string, details?: string) => {
      try {
        await supabaseAdmin.from('application_activity_logs').insert({
          application_id,
          application_type: type,
          action: actionLabel,
          details: details || null,
          admin_id: adminUserId || null,
        });
      } catch (logErr) {
        console.warn('Activity log insert failed (non-fatal):', logErr);
      }
    };

    // Helper: log audit records securely
    const recordApprovalAudit = async (auditAction: string, status: string, errorMsg?: string, metadata?: any) => {
      try {
        await supabaseAdmin.from('approval_audit_logs').insert({
          application_id,
          application_type: type,
          action: auditAction,
          performed_by: adminUserId || null,
          status: status,
          error_message: errorMsg || null,
          metadata: metadata || null,
        });
      } catch (logErr) {
        console.warn('Audit log insert failed (non-fatal):', logErr);
      }
    };

    // ─── APPROVE ─────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const { data: app, error: appError } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('id', application_id)
        .single();

      if (appError || !app) throw new Error(`Application not found: ${appError?.message}`);

      // Idempotency: Handle existing states
      if (app.provisioning_status === 'PROVISIONED' || app.status === 'approved') {
        await recordApprovalAudit('APPROVAL_REUSED', 'SUCCESS', undefined, { message: 'Already approved' });
        const rawPhoneAlready = type === 'partner' ? app.mobile_number : app.phone;
        const mobileAlready = normalizeIndianMobile(rawPhoneAlready || '');
        const { data: existingProfile } = mobileAlready
          ? await supabaseAdmin.from('profiles').select('id').eq('phone', mobileAlready).maybeSingle()
          : { data: null };
        return new Response(
          JSON.stringify({ success: true, user_id: existingProfile?.id ?? null, already_approved: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Concurrency protection
      if (app.provisioning_status === 'PROVISIONING') {
        throw new Error('Application is currently being provisioned by another process. Please wait.');
      }

      const rawPhone = type === 'partner' ? app.mobile_number : app.phone;
      const mobile = normalizeIndianMobile(rawPhone || '');
      if (!mobile) throw new Error('Application does not have a valid mobile number.');

      const normalizedEmail = app.email?.trim() ? app.email.trim().toLowerCase() : undefined;

      const fullName =
        type === 'agent' ? `${app.first_name || ''} ${app.last_name || ''}`.trim() :
        type === 'partner' ? app.full_name :
        app.contact_name;

      if (!fullName) throw new Error('Applicant name is missing.');

      // State Transition -> PROVISIONING
      const { error: markProvErr } = await supabaseAdmin.from(table)
        .update({ provisioning_status: 'PROVISIONING' })
        .eq('id', application_id);
      
      if (markProvErr) throw new Error('Failed to lock application for provisioning: ' + markProvErr.message);

      await recordApprovalAudit('APPROVAL_STARTED', 'SUCCESS');

      let userId: string | null = null;
      let finalError: Error | null = null;

      try {
        // Find an existing account by mobile first
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('phone', mobile)
          .maybeSingle();

        if (existingProfile) {
          userId = existingProfile.id;
          await recordApprovalAudit('USER_REUSED', 'SUCCESS', undefined, { user_id: userId });
        } else {
          const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            phone: mobile,
            phone_confirm: true,
            email: normalizedEmail,
            email_confirm: !!normalizedEmail,
            user_metadata: { full_name: fullName, role: type },
          });

          if (createdUser?.user) {
            userId = createdUser.user.id;
            await recordApprovalAudit('USER_CREATED', 'SUCCESS', undefined, { user_id: userId });
          } else if (createErr?.message?.toLowerCase().includes('already')) {
            // Pagination loop to find the exact existing user
            let foundUser = null;
            let page = 1;
            const perPage = 50;
            while (true) {
              const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
              if (listErr || !listData?.users || listData.users.length === 0) break;
              
              foundUser = listData.users.find(
                (u) => u.phone === mobile || (normalizedEmail && u.email === normalizedEmail)
              );
              if (foundUser || listData.users.length < perPage) break;
              page++;
            }
            if (foundUser) {
              userId = foundUser.id;
              await recordApprovalAudit('USER_REUSED', 'SUCCESS', undefined, { user_id: userId, reason: 'Recovered via auth list' });
            } else {
              throw new Error('Failed to create auth user: ' + createErr.message);
            }
          } else {
            throw new Error('Failed to create auth user: ' + (createErr?.message || 'Unknown error'));
          }
        }

        // Upsert profile
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
          id: userId,
          role: type,
          email: normalizedEmail || null,
          first_name: type === 'agent' ? app.first_name : fullName?.split(' ')[0],
          last_name: type === 'agent' ? app.last_name : fullName?.split(' ').slice(1).join(' '),
          phone: mobile,
          status: 'active',
          ...(type === 'agent' ? {
            license_number: app.license_number || null,
            company: app.company || null,
            bio: app.bio || null,
            specialization: app.specialization || null,
            assigned_areas: app.assigned_areas || null,
            avatar_url: app.profile_image || null,
            rera_document_url: app.license_doc_url || null,
            rera_verification_status: app.license_number ? 'pending' : 'not_submitted',
          } : {}),
        }, { onConflict: 'id' });
        
        if (profileErr) throw new Error('Failed to create or update user profile: ' + profileErr.message);
        await recordApprovalAudit('PROFILE_CREATED', 'SUCCESS', undefined, { user_id: userId });

        // For builders
        if (type === 'builder') {
          const { data: existingBuilder } = await supabaseAdmin
            .from('builders')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (!existingBuilder) {
            const { error: builderErr } = await supabaseAdmin.from('builders').insert({
              user_id: userId,
              name: app.company_name,
              logo_url: app.logo_url || null,
              description: app.description || null,
              established_year: app.established_year || null,
              contact_name: app.contact_name,
              contact_email: normalizedEmail,
              contact_phone: mobile,
              status: 'approved',
              public_visible: true,
            });
            if (builderErr) throw new Error('Failed to create builders record: ' + builderErr.message);
            await recordApprovalAudit('BUILDER_CREATED', 'SUCCESS', undefined, { user_id: userId });
          }
        }

        // For partners
        if (type === 'partner') {
          const { data: existingPartner } = await supabaseAdmin
            .from('partners')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (!existingPartner) {
            const { data: insertedPartner, error: partnerErr } = await supabaseAdmin.from('partners').insert({
              application_id: app.id,
              user_id: userId,
              full_name: app.full_name,
              mobile_number: mobile,
              email: normalizedEmail || null,
              partner_type: app.partner_type || null,
              company_name: app.company_name || null,
              status: 'active',
              verification_status: 'verified',
              approved_by: adminUserId,
              approved_at: new Date().toISOString(),
              gst_number: app.gst_number || null,
              pan_number: app.pan_number || null,
              website: app.website || null,
              business_registration_number: app.business_registration_number || null,
              address_line_1: app.address_line_1 || null,
              address_line_2: app.address_line_2 || null,
              country: app.country || 'India',
              state: app.state || null,
              city: app.city || null,
              district: app.district || null,
              pincode: app.pincode || null,
            }).select('id').single();
            if (partnerErr) throw new Error('Failed to create partner account: ' + partnerErr.message);
            await recordApprovalAudit('PARTNER_CREATED', 'SUCCESS', undefined, { user_id: userId });

            // Seed partner_documents from the application's doc-URL snapshot so
            // the partner doesn't land on an empty Documents tab post-approval.
            const docTypeByColumn: Record<string, string> = {
              pan_doc_url: 'pan',
              id_doc_url: 'govt_id',
              gst_doc_url: 'gst_certificate',
              business_reg_doc_url: 'business_registration',
              address_proof_doc_url: 'address_proof',
              other_doc_url: 'other',
            };
            const seedDocs = Object.entries(docTypeByColumn)
              .filter(([col]) => !!app[col])
              .map(([col, document_type]) => ({
                partner_id: insertedPartner?.id,
                user_id: userId,
                document_type,
                storage_path: app[col],
                status: 'under_review',
                uploaded_at: app.created_at,
              }));
            if (seedDocs.length > 0) {
              const { error: docsErr } = await supabaseAdmin.from('partner_documents').insert(seedDocs);
              if (docsErr) console.warn('Failed to seed partner_documents (non-fatal):', docsErr.message);
            }
          }
        }
      } catch (err: any) {
        finalError = err;
      }

      // If anything failed, rollback state to PROVISIONING_FAILED
      if (finalError) {
        await supabaseAdmin.from(table).update({
          provisioning_status: 'PROVISIONING_FAILED'
        }).eq('id', application_id);
        
        await recordApprovalAudit('APPROVAL_FAILED', 'FAILED', finalError.message);
        throw finalError; // Rethrow to be caught by the outer catch block
      }

      // Mark as fully approved
      const { error: updateErr } = await supabaseAdmin.from(table).update({
        status: 'approved',
        provisioning_status: 'PROVISIONED',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        ...(type === 'partner' ? { approved_at: new Date().toISOString() } : {}),
      }).eq('id', application_id);
      
      if (updateErr) {
        await recordApprovalAudit('APPROVAL_FAILED', 'FAILED', updateErr.message);
        throw new Error('Failed to update application status: ' + updateErr.message);
      }

      await logActivity('Application Approved', remarks || 'Account provisioned successfully.');
      await recordApprovalAudit('APPROVAL_COMPLETED', 'SUCCESS');

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── REJECT ──────────────────────────────────────────────────────────────
    } else if (action === 'reject') {
      const { error: updateErr } = await supabaseAdmin.from(table).update({
        status: 'rejected',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: remarks || null,
      }).eq('id', application_id);
      if (updateErr) throw new Error('Failed to reject application: ' + updateErr.message);

      await logActivity('Application Rejected', remarks || 'Rejected by admin.');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── STAGE CHANGE ─────────────────────────────────────────────────────────
    } else if (action === 'stage_change') {
      if (!new_stage) throw new Error('new_stage is required for stage_change action');

      const validStages = [
        'submitted', 'pending_review', 'document_verification',
        // Agent-specific
        'identity_verification',
        // Builder-specific
        'company_verification', 'project_verification',
        // Shared
        'rera_verification', 'background_verification', 'final_review',
        'approved', 'rejected', 'changes_requested',
      ];
      if (!validStages.includes(new_stage)) {
        throw new Error(`Invalid stage: ${new_stage}`);
      }

      const updatePayload: Record<string, any> = { status: new_stage };
      if (verification_state !== undefined) {
        updatePayload.verification_state = verification_state;
      }

      const { error: updateErr } = await supabaseAdmin.from(table)
        .update(updatePayload)
        .eq('id', application_id);
      if (updateErr) throw new Error('Failed to update stage: ' + updateErr.message);

      await logActivity(
        `Moved to ${new_stage.replace(/_/g, ' ')}`,
        remarks || null
      );

      return new Response(JSON.stringify({ success: true, new_stage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── SAVE VERIFICATION STATE ONLY ─────────────────────────────────────────
    } else if (action === 'save_verification') {
      if (verification_state === undefined) throw new Error('verification_state is required for save_verification action');

      const { error: updateErr } = await supabaseAdmin.from(table)
        .update({ verification_state })
        .eq('id', application_id);
      if (updateErr) throw new Error('Failed to save verification state: ' + updateErr.message);

      if (remarks) {
        await logActivity(remarks, null);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── SUSPEND / REACTIVATE ───────────────────────────────────────────────
    // Account-level action, not an application pipeline stage — the
    // application row stays as the historical onboarding record.
    } else if (action === 'suspend' || action === 'reactivate') {
      const { data: app, error: appError } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('id', application_id)
        .single();
      if (appError || !app) throw new Error(`Application not found: ${appError?.message}`);
      if (app.status !== 'approved') throw new Error('Only an approved application can be suspended or reactivated.');

      const rawPhone = type === 'partner' ? app.mobile_number : app.phone;
      const mobile = normalizeIndianMobile(rawPhone || '');
      if (!mobile) throw new Error('Could not resolve the account phone number for this application.');

      const { data: acctProfile } = await supabaseAdmin.from('profiles').select('id').eq('phone', mobile).maybeSingle();
      if (!acctProfile) throw new Error('No activated account found for this application.');

      const suspending = action === 'suspend';
      await supabaseAdmin.from('profiles').update({ status: suspending ? 'suspended' : 'active' }).eq('id', acctProfile.id);

      if (type === 'partner') {
        await supabaseAdmin.from('partners').update({ status: suspending ? 'suspended' : 'active' }).eq('user_id', acctProfile.id);
      } else if (type === 'builder') {
        await supabaseAdmin.from('builders').update({ status: suspending ? 'suspended' : 'approved' }).eq('user_id', acctProfile.id);
      }

      await logActivity(suspending ? 'Account Suspended' : 'Account Reactivated', remarks || null);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error(`Invalid action: ${action}`);
    }

  } catch (err: any) {
    console.error('process-application error:', err.message);
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
