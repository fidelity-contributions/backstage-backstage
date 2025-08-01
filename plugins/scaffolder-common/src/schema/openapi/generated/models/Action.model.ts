/*
 * Copyright 2025 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ******************************************************************
// * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY. *
// ******************************************************************
import { ActionExample } from '../models/ActionExample.model';
import { ActionSchema } from '../models/ActionSchema.model';

/**
 * The response shape for a single action in the `listActions` call to the `scaffolder-backend`
 * @public
 */
export interface Action {
  id: string;
  description?: string;
  examples?: Array<ActionExample>;
  schema?: ActionSchema;
}
