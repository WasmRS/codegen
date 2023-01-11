import * as model from "./deps/apex_model.ts";

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(_context: Context): void {
    this.write(`
pub(crate) mod actions;
mod error;
pub use error::Error;
    `);
  }
}
