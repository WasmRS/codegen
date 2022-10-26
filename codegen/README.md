# Iota Code Generators

## Local development

### Install npm dependencies

```
just install
```

### Build all packages

```
just build
```

### Run all tests

```
just test
```

### Remove all node_modules

```
just clean
```

### Link against local packages

When developing against local development versions of apex or apex codegen, link the local modules with the following command

```
pnpm link ../path/to/apex/codegen
```
