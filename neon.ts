import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Only Postgres is used: the site stores form submissions in public.inquiries,
  // so no Auth, Data API, Functions, Object Storage, or AI Gateway are declared.
  branch: (branch) => {
    if (branch.isDefault) {
      // Production holds the live inquiries table. Protecting it would be ideal,
      // but this account has used its protected-branch allowance already, so
      // `neon deploy` fails with HTTP 422:
      //   "You have reached the maximum number of protected branches for your
      //    current plan."
      // Re-enable once the plan allows it, or once another project frees a slot:
      //   return { protected: true };
      return {};
    }

    if (!branch.exists) {
      // Branches created with `neon checkout <name>` (previews, experiments)
      // expire on their own instead of leaving compute running indefinitely.
      return { ttl: "7d" };
    }

    // Branches that already exist are left untouched.
    return {};
  },
});
