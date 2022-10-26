# WasmRS Code Generators

This library provides the code generators for producing WasmRS modules using the [Apex language](https://apexlang.io).

## Installation

Make sure you have the Apex CLI installed. Here are [the instructions](https://apexlang.io/docs/getting-started).

From your terminal, run:

```shell
apex install @wasmrs/codegen
```

Now you should see WasmRS project templates available.

```shell
apex list templates
```

```
+-------------------------+---------------------------------------+
| NAME                    | DESCRIPTION                           |
+-------------------------+---------------------------------------+
| ...                     | ...                                   |
| @wasmrs/assemblyscript  | AssemblyScript WasmRS module project  |
| @wasmrs/tinygo          | TinyGo WasmRS module project          |
+-------------------------+---------------------------------------+
```

To create a new TinyGo WasmRS module, run:

```shell
apex new @wasmrs/tinygo hello-world
cd hello-world
make
ls -l build
```

```
-rwxr-xr-x  1 uname  staff  18454 Sep 19 14:56 hello-world.wasm
```

If you load the project in VS Code (`code .` from the terminal if VS code is in your path), a task will monitor the Apex interface definition for changes and regenerate boilerplate code. If prompted with "Do you allow automatic tasks to run when you open this workspace?", select "Allow and run".
