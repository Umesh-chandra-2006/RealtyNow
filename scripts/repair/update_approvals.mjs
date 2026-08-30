import fs from 'fs';
const file = 'e:/Realtynow_new/src/pages/admin/approvals.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("import { useState } from 'react';", "import { useState, useEffect } from 'react';");
const startMarker = 'export function AdminApprovals() {';
const endMarker = 'export function AdminProperties() {';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found');
  process.exit(1);
}

const newComponent = `export function AdminApprovals() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PendingProperty | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('*, owner:profiles!owner_id(first_name, last_name, email, phone), cities(name), localities(name), property_types(name)')
        .in('status', ['submitted', 'pending_verification', 'changes_requested', 'approved', 'rejected'])
        .order('created_at', { ascending: false });
      return (data ?? []).map((p) => {
        const mapped = mapJoined(p as unknown as Record<string, unknown>);
        const j = p as unknown as JoinedNames;
        return { ...mapped, owner: j.owner ?? null } as unknown as PendingProperty;
      });
    },
  });

  useEffect(() => {
    const channel = supabase.channel('admin-approvals-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      await updatePropertyStatus(id, status as Property['status'], reason);
      if (['published', 'approved', 'rejected', 'changes_requested'].includes(status)) {
        const property = data?.find((p) => p.id === id);
        if (property?.owner?.email) {
          await supabase.from('notifications').insert({
            user_id: property.owner_id,
            type: 'property_status',
            title: \`Property \${status}\`,
            body: \`Your property "\${property.title}" status is now \${status}.\${reason ? \` Reason: \${reason}\` : ''}\`,
            link: \`/property/\${id}\`,
          });
        }
      }
    },
    onSuccess: () => {
      setSelected(null);
      setShowReject(false);
      setShowRequestChanges(false);
      setRejectionReason('');
      setRejectError('');
    },
  });

  const columns: Column<PendingProperty>[] = [
    { key: 'id', header: 'ID', render: (p) => <span className="font-mono text-xs text-navy-500">{p.id.slice(0, 8)}</span> },
    {
      key: 'title', header: 'Property', sortable: true, render: (p) => (
        <div className="flex items-center gap-3">
          <img src={p.images?.[0] ?? 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'} alt="" className="h-10 w-14 rounded object-cover" />
          <div>
            <Link to={\`/property/\${p.id}\`} className="font-medium text-navy-900 hover:underline line-clamp-1">{p.title}</Link>
            <p className="text-xs text-navy-500">{p.property_type_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'customer', header: 'Customer', render: (p) => (
        <div>
          <p className="font-medium text-navy-900">{p.owner?.first_name} {p.owner?.last_name}</p>
          <p className="text-xs text-navy-500">{p.owner?.email}</p>
        </div>
      )
    },
    { key: 'city', header: 'City', render: (p) => p.city_name },
    { key: 'price', header: 'Price', sortable: true, render: (p) => <span className="font-semibold">{formatPrice(p.price, p.purpose)}</span> },
    { key: 'purpose', header: 'Listing Type', render: (p) => <Badge variant="default">{p.purpose}</Badge> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'created_at', header: 'Submitted Date', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'actions', header: 'Actions', render: (p) => (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setSelected(p)}>Review</Button>
          {p.status === 'approved' && (
            <Button size="sm" variant="gold" onClick={() => statusMutation.mutate({ id: p.id, status: 'published' })} loading={statusMutation.isPending}>Publish</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout sections={adminSections} title="Approvals">
      <PageHeader title="Property approvals" subtitle="Review and approve submitted properties, then publish to the portal." />

      <div className="mb-6">
        <DataTable
          columns={columns}
          rows={data ?? []}
          loading={isLoading}
          getRowId={(p) => p.id}
          pageSize={10}
          selectedIds={selectedIds}
          onToggleSelect={(id) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
          onSelectAll={(ids) => setSelectedIds((s) => { const n = new Set(s); ids.forEach((id) => n.has(id) ? n.delete(id) : n.add(id)); return n; })}
        />
      </div>

      {/* Review Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review property details"
        size="lg"
        footer={
          selected && (
            <div className="flex flex-wrap gap-2">
              {selected.status === 'approved' ? (
                <Button variant="gold" icon={<Send className="h-4 w-4" />} onClick={() => statusMutation.mutate({ id: selected.id, status: 'published' })} loading={statusMutation.isPending}>
                  Publish (Go live)
                </Button>
              ) : (
                <Button variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => statusMutation.mutate({ id: selected.id, status: 'approved' })} loading={statusMutation.isPending}>
                  Approve
                </Button>
              )}
              <Button variant="secondary" onClick={() => { setRejectError(''); setShowRequestChanges(true); }}>Request Changes</Button>
              <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => { setRejectError(''); setShowReject(true); }}>Reject</Button>
              <Link to={\`/property/\${selected.id}\`} target="_blank"><Button variant="secondary" icon={<Eye className="h-4 w-4" />}>Open Listing</Button></Link>
            </div>
          )
        }
      >
        {selected && (
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            {selected.images?.[0] && <img src={selected.images[0]} alt="" className="mb-4 aspect-video w-full rounded-lg object-cover" />}
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-navy-500">Title:</span> <span className="font-medium">{selected.title}</span></p>
                  <p><span className="text-navy-500">Property Type:</span> <span className="font-medium">{selected.property_type_name}</span></p>
                  <p><span className="text-navy-500">Listing Type:</span> <span className="font-medium">{selected.purpose}</span></p>
                  <p><span className="text-navy-500">Price:</span> <span className="font-medium text-navy-900">{formatPrice(selected.price, selected.purpose)}</span></p>
                </div>
              </div>
              
              <div>
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Customer Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-navy-500">Name:</span> <span className="font-medium">{selected.owner?.first_name} {selected.owner?.last_name}</span></p>
                  <p><span className="text-navy-500">Email:</span> <span className="font-medium">{selected.owner?.email}</span></p>
                </div>
              </div>

              <div className="md:col-span-2">
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Location</h3>
                <p className="text-sm text-navy-800">{selected.address}</p>
                <p className="text-sm text-navy-600">{selected.locality_name}, {selected.city_name}</p>
              </div>

              <div className="md:col-span-2">
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Specifications</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {selected.bedrooms != null && <div><p className="text-navy-400">Bedrooms</p><p className="font-medium">{selected.bedrooms}</p></div>}
                  {selected.bathrooms != null && <div><p className="text-navy-400">Bathrooms</p><p className="font-medium">{selected.bathrooms}</p></div>}
                  {selected.built_up_area != null && <div><p className="text-navy-400">Area</p><p className="font-medium">{selected.built_up_area} sqft</p></div>}
                  {selected.facing != null && <div><p className="text-navy-400">Facing</p><p className="font-medium">{selected.facing}</p></div>}
                  {selected.furnishing != null && <div><p className="text-navy-400">Furnishing</p><p className="font-medium">{selected.furnishing}</p></div>}
                </div>
              </div>

              {selected.amenities && selected.amenities.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Amenities</h3>
                  <div className="flex flex-wrap gap-2">{selected.amenities.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}</div>
                </div>
              )}
              
              {selected.description && (
                <div className="md:col-span-2">
                  <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Description</h3>
                  <p className="text-sm text-navy-700 whitespace-pre-line">{selected.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal
        open={showReject}
        onClose={() => { setShowReject(false); setRejectError(''); }}
        title="Reject property"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowReject(false); setRejectError(''); }}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              if (!rejectionReason.trim()) { setRejectError('Rejection reason is required'); return; }
              setRejectError('');
              selected && statusMutation.mutate({ id: selected.id, status: 'rejected', reason: rejectionReason });
            }} loading={statusMutation.isPending}>Confirm reject</Button>
          </>
        }
      >
        <Textarea label="Reason for rejection" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Missing ownership documents, images unclear..." error={rejectError} />
      </Modal>

      {/* Request Changes modal */}
      <Modal
        open={showRequestChanges}
        onClose={() => { setShowRequestChanges(false); setRejectError(''); }}
        title="Request Changes"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowRequestChanges(false); setRejectError(''); }}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              if (!rejectionReason.trim()) { setRejectError('Comments are required'); return; }
              setRejectError('');
              selected && statusMutation.mutate({ id: selected.id, status: 'changes_requested', reason: rejectionReason });
            }} loading={statusMutation.isPending}>Send to Customer</Button>
          </>
        }
      >
        <Textarea label="Comments for customer" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Please upload a clearer image of the front facade..." error={rejectError} />
      </Modal>

    </DashboardLayout>
  );
}

`;

content = content.slice(0, startIndex) + newComponent + content.slice(endIndex);
fs.writeFileSync(file, content, 'utf8');
console.log('Updated approvals.tsx successfully');
