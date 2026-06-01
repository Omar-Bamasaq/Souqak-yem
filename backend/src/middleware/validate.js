import Joi from "joi";

export function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: "Validation error",
        details: error.details.map((d) => ({ message: d.message, path: d.path }))
      });
    }
    req.body = value;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: "Validation error",
        details: error.details.map((d) => ({ message: d.message, path: d.path }))
      });
    }
    req.query = value;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: "Validation error",
        details: error.details.map((d) => ({ message: d.message, path: d.path }))
      });
    }
    req.params = value;
    next();
  };
}

