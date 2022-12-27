wasmrs_guest::add_import(
  u32::from_be_bytes(${importConstant}_INDEX_BYTES),OperationType::RequestResponse,"${namespace}.${iface}","${op}",
);