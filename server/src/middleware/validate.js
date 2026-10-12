// Validate req.body / req.query with a zod schema and replace it with the parsed value.
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(parsed.error);
  if (source === 'body') req.body = parsed.data;
  else req.validated = parsed.data;
  next();
};
