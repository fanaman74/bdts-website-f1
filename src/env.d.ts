/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts for every /admin request with a valid session. */
    user?: import('./lib/users').User;
  }
}
