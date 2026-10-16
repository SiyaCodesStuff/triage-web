import type { paths } from '@/api/schema';

export type ApiMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
export type ApiPath<M extends ApiMethod> = {
  [P in keyof paths]: NonNullable<paths[P][M]> extends never ? never : P;
}[keyof paths];
type Operation<P extends keyof paths, M extends ApiMethod> = NonNullable<
  paths[P][M]
>;
type Parameter<
  P extends keyof paths,
  M extends ApiMethod,
  K extends 'path' | 'query',
> =
  Operation<P, M> extends { parameters: infer Params }
    ? K extends keyof Params
      ? NonNullable<Params[K]>
      : never
    : never;
type JsonBody<P extends keyof paths, M extends ApiMethod> =
  Operation<P, M> extends { requestBody?: infer Body }
    ? NonNullable<Body> extends { content: { 'application/json': infer Json } }
      ? Json
      : never
    : never;
type Field<K extends string, Value, Required extends boolean> = [
  Value,
] extends [never]
  ? { [Key in K]?: never }
  : Required extends true
    ? { [Key in K]: Value }
    : { [Key in K]?: Value };

export type ApiRequestOptions<P extends keyof paths, M extends ApiMethod> = {
  auth?: 'required' | 'optional';
  headers?: HeadersInit;
  signal?: AbortSignal;
} & Field<'params', Parameter<P, M, 'path'>, true> &
  Field<
    'query',
    Parameter<P, M, 'query'>,
    Record<string, never> extends Parameter<P, M, 'query'> ? false : true
  > &
  Field<
    'body',
    M extends 'get' | 'head' ? never : JsonBody<P, M>,
    Operation<P, M> extends { requestBody: unknown } ? true : false
  >;

export type ApiRequestArgs<P extends keyof paths, M extends ApiMethod> =
  Record<string, never> extends ApiRequestOptions<P, M>
    ? [options?: ApiRequestOptions<P, M>]
    : [options: ApiRequestOptions<P, M>];

type Success<Responses> = {
  [Status in keyof Responses]: Status extends string | number
    ? `${Status}` extends `2${string}`
      ? Responses[Status] extends {
          content: { 'application/json': infer Json };
        }
        ? Json
        : undefined
      : never
    : never;
}[keyof Responses];

export type ApiResponse<P extends keyof paths, M extends ApiMethod> =
  Operation<P, M> extends { responses: infer Responses }
    ? Success<Responses>
    : never;
