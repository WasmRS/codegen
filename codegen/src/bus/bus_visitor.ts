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
  BaseVisitor,
  Context,
} from "https://deno.land/x/apex_core@v0.1.0/model/mod.ts";
import {
  isEvents,
  isProvider,
  isService,
  noCode,
  snakeCase,
} from "https://deno.land/x/apex_codegen@v0.1.0/utils/mod.ts";

export class BusVisitor extends BaseVisitor {
  visitNamespaceBefore(context: Context): void {
    const appName = context.config.name;
    this.write(`application:
  id: ${appName}
  version: 0.0.1
  environment: local

transports:
  rest:
    uses: rest
    with:
      address: :8080
      documentation:
        swaggerUI: true
        postman: true
        restClient: true
  httprpc:
    uses: httprpc
    with:
      address: :9090

compute:
  - uses: wasmrs
    with:
      filename: build/${appName}.wasm

specs:
  - uses: apex
    with:
      filename: apex.aidl

# json, msgpack, and xml are built-in codecs.
# Configure others here.
codecs:
  # avro:
  #   type: confluentavro
  #   with:
  #     schemaRegistryURLs:
  #       - http://localhost:8081

inputBindings:
  # - binding: twitter
  #   codec: json
  #   function: handleTweet

subscriptions:
  # - pubsub: pubsub
  #   topic: mytopic
  #   codec: json

resiliency:
  retries:
    events:
      policy: constant
      duration: 3s

    # database:
    #   policy: constant
    #   duration: 3s
    #
    # publish:
    #   policy: constant
    #   duration: 3s

  circuitBreakers:
    # database:
    #   policy: constant
    #   duration: 3s
    #
    # publish:
    #   maxRequests: 2
    #   timeout: 30s

services:\n`);
    const services = new ServicesVisitor(this.writer);
    context.namespace.accept(context, services);

    this.write(`\nevents:\n`);
    const events = new EventsVisitor(this.writer);
    context.namespace.accept(context, events);

    this.write(`\nproviders:\n`);
    const providers = new ProvidersVisitor(this.writer);
    context.namespace.accept(context, providers);
  }
}

class ServicesVisitor extends BaseVisitor {
  visitInterface(context: Context): void {
    if (!isService(context)) {
      return;
    }

    const { namespace: ns, interface: iface } = context;
    this.write(`  '${ns.name}.${iface.name}':\n`);
  }

  visitOperation(context: Context): void {
    if (!isService(context)) {
      return;
    }

    const oper = context.operation!;
    const nocode = noCode(oper);
    const comment = nocode ? "" : "# ";
    const operName = oper.name;
    this.write(`    ${comment}${operName}:\n`);
    if (oper.description) {
      this.write(`    ${comment}  name: ${oper.description}\n`);
    }
    this.write(`    ${comment}  steps:\n\n`);
  }
}

interface Value {
  value: string;
}

class EventsVisitor extends BaseVisitor {
  visitOperation(context: Context): void {
    if (!isEvents(context)) {
      return;
    }

    const { namespace: ns, interface: iface, operation } = context;
    let func = operation.name;
    operation.annotation("type", (a) => {
      const v: Value = a.convert();
      func = v.value;
    });
    this.write(`    ${func}:\n`);
    if (operation.description) {
      this.write(`      name: ${operation.description}\n`);
    }
    this.write(`      steps:
        - name: Send to route
          uses: invoke
          with:
            namespace: ${ns.name}.${iface.name}
            operation: ${operation.name}
            input: input.data
          retry: events\n\n`);
  }
}

class ProvidersVisitor extends BaseVisitor {
  visitInterface(context: Context): void {
    if (!isProvider(context)) {
      return;
    }

    const { namespace: ns, interface: iface } = context;
    this.write(`  '${ns.name}.${iface.name}':\n`);
  }

  visitOperation(context: Context): void {
    if (!isProvider(context)) {
      return;
    }

    const oper = context.operation!;
    const operName = oper.name;
    const cloudEventsType = snakeCase(
      operName.replace(/^(send|raise|notify)/, ""),
    ).replaceAll("_", ".");
    this.write(`    ${operName}:\n`);
    if (oper.description) {
      this.write(`      name: ${oper.description}\n`);
    }
    this.write(`      steps:\n`);
    if (
      operName.startsWith("send") ||
      operName.startsWith("raise") ||
      operName.endsWith("Created") ||
      operName.endsWith("Updated") ||
      operName.endsWith("Deleted") ||
      operName.endsWith("Moved") ||
      operName.endsWith("Notification")
    ) {
      this.write(`        # - name: Publish event
        #   uses: '@dapr/publish_message'
        #   with:
        #     resource: pubsub
        #     topic: mytopic
        #     codec: cloudevents+json
        #     key: input.id
        #     data: |
        #       {
        #         "type": "${cloudEventsType}",
        #         "data": input
        #       }
        #   retry: publish
        #   circuitBreaker: publish\n\n`);
    } else if (
      operName.startsWith("get") ||
      operName.startsWith("load") ||
      operName.startsWith("fetch")
    ) {
      this.write(`        # - name: Get state
        #   uses: '@dapr/get_state'
        #   with:
        #     resource: statestore
        #     key: input.id
        #   retry: database
        #   circuitBreaker: database\n\n`);
    } else {
      this.write(`        # - name: Save state
        #   uses: '@dapr/set_state'
        #   with:
        #     resource: statestore
        #     items:
        #       - key: input.id
        #   retry: database
        #   circuitBreaker: database\n\n`);
    }
  }
}
