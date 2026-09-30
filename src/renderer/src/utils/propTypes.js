// Lightweight prop validators: no new runtime dependency.
export const functionProp = (props, name) =>
  props[name] == null || typeof props[name] === 'function'
    ? null
    : new Error(`${name}: function required`)
export const stringProp = (props, name) =>
  props[name] == null || typeof props[name] === 'string'
    ? null
    : new Error(`${name}: string required`)
export const objectProp = (props, name) =>
  props[name] != null && typeof props[name] === 'object'
    ? null
    : new Error(`${name}: object required`)
