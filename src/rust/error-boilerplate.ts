import * as model from "../deps/core/model.ts";

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(_context: Context): void {
    this.write(`
#[derive(thiserror::Error, Debug)]
pub enum Error {
  #[error(transparent)]
  PayloadError(#[from] wasmrs_guest::PayloadError),
  #[error(transparent)]
  Protocol(#[from] wasmrs_guest::Error),

  #[error("An example of a custom error variant")]
  ExampleError,
}
    `);
  }
}
