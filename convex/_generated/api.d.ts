/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as badges from "../badges.js";
import type * as boardSettings from "../boardSettings.js";
import type * as crons from "../crons.js";
import type * as giftActions from "../giftActions.js";
import type * as giftCrypto from "../giftCrypto.js";
import type * as giftLab from "../giftLab.js";
import type * as giftShareRender from "../giftShareRender.js";
import type * as giftWebhooks from "../giftWebhooks.js";
import type * as gifts from "../gifts.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as profiles from "../profiles.js";
import type * as sharePages from "../sharePages.js";
import type * as siteDirectory from "../siteDirectory.js";
import type * as siteFiles from "../siteFiles.js";
import type * as slack from "../slack.js";
import type * as validators from "../validators.js";
import type * as xAccountActivity from "../xAccountActivity.js";
import type * as xAccountActivityActions from "../xAccountActivityActions.js";
import type * as xAccountActivityPayload from "../xAccountActivityPayload.js";
import type * as xAccountActivityWebhooks from "../xAccountActivityWebhooks.js";
import type * as xSync from "../xSync.js";
import type * as xSyncParsing from "../xSyncParsing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  badges: typeof badges;
  boardSettings: typeof boardSettings;
  crons: typeof crons;
  giftActions: typeof giftActions;
  giftCrypto: typeof giftCrypto;
  giftLab: typeof giftLab;
  giftShareRender: typeof giftShareRender;
  giftWebhooks: typeof giftWebhooks;
  gifts: typeof gifts;
  http: typeof http;
  imports: typeof imports;
  profiles: typeof profiles;
  sharePages: typeof sharePages;
  siteDirectory: typeof siteDirectory;
  siteFiles: typeof siteFiles;
  slack: typeof slack;
  validators: typeof validators;
  xAccountActivity: typeof xAccountActivity;
  xAccountActivityActions: typeof xAccountActivityActions;
  xAccountActivityPayload: typeof xAccountActivityPayload;
  xAccountActivityWebhooks: typeof xAccountActivityWebhooks;
  xSync: typeof xSync;
  xSyncParsing: typeof xSyncParsing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agentReady: import("@waynesutton/agent-ready/_generated/component.js").ComponentApi<"agentReady">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
