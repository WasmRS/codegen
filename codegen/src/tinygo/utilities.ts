/*
Copyright 2022 The NanoBus Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {
  AnyType,
  Kind,
  Operation,
  Parameter,
  Stream,
} from "../deps/core/model.ts";

export interface OperationParts {
  type: string;
  unaryIn?: Parameter;
  parameters: Parameter[];
  streamIn?: StreamParam;
  returns: AnyType;
  returnPackage: string;
}

export interface StreamParam {
  parameter: Parameter;
  type: AnyType;
}

export function getOperationParts(operation: Operation): OperationParts {
  let rxType = "RequestResponse";
  const parameters = operation.parameters.filter(
    (p) => p.type.kind != Kind.Stream,
  );
  const streams = operation.parameters
    .filter((p) => p.type.kind == Kind.Stream)
    .map((p) => {
      return {
        parameter: p,
        type: (p.type as Stream).type,
      } as StreamParam;
    });
  const streamIn = streams.length > 0 ? streams[0] : undefined;

  if (streams.length > 1) {
    throw new Error(
      `There can only be zero or one stream parameter. Found ${streams.length}.`,
    );
  }
  let returns = operation.type;
  if (streamIn || operation.type.kind == Kind.Stream) {
    rxType = streamIn ? "RequestChannel" : "RequestStream";
    if (operation.type.kind == Kind.Stream) {
      returns = (operation.type as Stream).type;
    }
  }

  const unaryIn = operation.isUnary() && parameters.length > 0
    ? parameters[0]
    : undefined;

  const returnPackage = operation.type.kind == Kind.Stream ? "flux" : "mono";

  return {
    type: rxType,
    unaryIn: unaryIn,
    parameters: parameters,
    streamIn: streamIn,
    returns: returns,
    returnPackage: returnPackage,
  };
}
