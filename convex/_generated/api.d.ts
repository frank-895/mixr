/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as captionText from "../captionText.js";
import type * as captions from "../captions.js";
import type * as games from "../games.js";
import type * as input from "../input.js";
import type * as internal_captionDedupe from "../internal/captionDedupe.js";
import type * as internal_captionEmbedding from "../internal/captionEmbedding.js";
import type * as internal_gameCleanup from "../internal/gameCleanup.js";
import type * as internal_roundTransitions from "../internal/roundTransitions.js";
import type * as players from "../players.js";
import type * as rounds from "../rounds.js";
import type * as seed from "../seed.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  captionText: typeof captionText;
  captions: typeof captions;
  games: typeof games;
  input: typeof input;
  "internal/captionDedupe": typeof internal_captionDedupe;
  "internal/captionEmbedding": typeof internal_captionEmbedding;
  "internal/gameCleanup": typeof internal_gameCleanup;
  "internal/roundTransitions": typeof internal_roundTransitions;
  players: typeof players;
  rounds: typeof rounds;
  seed: typeof seed;
  votes: typeof votes;
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

export declare const components: {};
