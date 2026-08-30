const { z } = require('zod');

const propertyWizardSchema = z.object({
  media_urls: z
    .object({
      videos: z.array(z.string()).optional(),
      virtual_tour: z.string().optional(),
      floor_plan: z.string().optional(),
      brochure: z.string().optional(),
    })
    .optional(),
});

const data = {
  media_urls: {
    videos: [undefined],
    virtual_tour: ""
  }
};

const result = propertyWizardSchema.safeParse(data);
console.log(JSON.stringify(result, null, 2));
