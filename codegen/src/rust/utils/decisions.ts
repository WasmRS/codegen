// Central location for branch condition logic to ensure consistency.
import { rust } from "../../deps/codegen/mod.ts";

import { ObjectMap, Operation, Stream } from "../../deps/core/model.ts";
import { convertDescription } from "./conversions.ts";
import { ActionKind, constantCase, determineVariant, stream } from "./mod.ts";
import { convertType } from "./types.ts";
const { rustify, rustifyCaps } = rust.utils;

interface OpDecisions {
  safeName: string;
  lcName: string;
  ucName: string;
  serviceModule: string;
  operationModule: string;
  componentName: string;
  hasOutputStream: boolean;
  qualifiedInputType: string;
  qualifiedOutputType: string;
  indexConstant: string;
  inputTypeName: string;
  outputTypeName: string;
  genericInputType: string;
  genericOutputType: string;
  outputType: string;
  comment: string;
  variant: ActionKind;
  actionPath: string;
}

export function operationDecisions(
  op: Operation,
  iface: string,
  config: ObjectMap,
): OpDecisions {
  const ucName = rustifyCaps(op.name);
  const lcName = rustify(op.name, true);
  const safeName = rustify(op.name);
  const hasOutputStream = stream(op.type);
  const inputTypeName = "Input";
  const outputTypeName = "Output";

  const serviceModule = `${rustify(iface)}_service`;
  const operationModule = `${serviceModule}::${lcName}`;
  const componentName = `${rustifyCaps(iface)}Component`;
  const actionPath = `${componentName}::${lcName}`;
  const indexConstant = constantCase(`${iface}_${lcName}`);

  const genericInputType = `${lcName}::${inputTypeName}`;
  const genericOutputType = `${lcName}::${outputTypeName}`;
  const comment = convertDescription(op.description);
  const variant = determineVariant(op);

  let qualifiedInputType;
  if (op.unary) {
    qualifiedInputType = convertType(op.parameters[0].type, config);
  } else {
    qualifiedInputType = `${operationModule}::${inputTypeName}`;
  }
  const qualifiedOutputType = `${operationModule}::${outputTypeName}`;

  const outputType = hasOutputStream
    ? convertType((op.type as Stream).type, config)
    : convertType(op.type, config);

  return {
    actionPath,
    variant,
    comment,
    outputType,
    outputTypeName,
    inputTypeName,
    qualifiedInputType,
    qualifiedOutputType,
    genericInputType,
    genericOutputType,
    serviceModule,
    operationModule,
    componentName,
    hasOutputStream,
    safeName,
    lcName,
    ucName,
    indexConstant,
  };
}
