import { SetMetadata } from "@nestjs/common";

export const SKIP_RESPONSE_TRANSFORM_KEY = "skipResponseTransform";

/** Opt out of {@link TransformInterceptor} (e.g. SSE streams must not be JSON-wrapped). */
export const SkipResponseTransform = () =>
  SetMetadata(SKIP_RESPONSE_TRANSFORM_KEY, true);
