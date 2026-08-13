import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "zoom",
    framework: "nextjs",
    env: ".env",
  },
});
