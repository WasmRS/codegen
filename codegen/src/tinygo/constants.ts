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

export const primitiveTransformers = new Map<string, string>([
  ["bool", "transform.Bool"],
  ["string", "transform.String"],
  ["datetime", "transform.Time"],
  ["i8", "transform.Int8"],
  ["u8", "transform.Uint8"],
  ["i16", "transform.Int16"],
  ["u16", "transform.Uint16"],
  ["i32", "transform.Int32"],
  ["u32", "transform.Uint32"],
  ["i64", "transform.Int64"],
  ["u64", "transform.Uint64"],
  ["f32", "transform.Float32"],
  ["f64", "transform.Float64"],
  ["bytes", "transform.Bytes"],
]);
