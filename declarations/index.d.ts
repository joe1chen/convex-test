import { type ActionBuilder, type ApiFromModules, type DataModelFromSchemaDefinition, type FilterApi, type FunctionReference, type FunctionReturnType, type GenericActionCtx, type GenericDataModel, type GenericMutationCtx, type GenericQueryCtx, type GenericSchema, type MutationBuilder, type OptionalRestArgs, type QueryBuilder, type RequestMetadata, type SchemaDefinition, type UserIdentity } from "convex/server";
import { type TransactionMetrics } from "./transactionMetrics.js";
export type TestConvex<SchemaDef extends SchemaDefinition<any, boolean>> = TestConvexRoot<DataModelFromSchemaDefinition<SchemaDef>>;
export type ComponentRegistration<Api> = (t: TestConvexRoot<any>, name: string) => Api | void;
type ComponentApiForName<Api, Name extends string> = Api extends FunctionReference<infer Type, infer Visibility, infer Args, infer ReturnType> ? FunctionReference<Type, Visibility, Args, ReturnType, Name> : {
    [Key in keyof Api]: ComponentApiForName<Api[Key], Name>;
};
type ComponentRegistrations = Record<string, {
    register: ComponentRegistration<any>;
}>;
type RegisteredComponents<Components extends ComponentRegistrations> = {
    [Name in keyof Components]: Components[Name]["register"] extends ComponentRegistration<infer Api> ? ComponentApiForName<Api, Name & string> : never;
};
export type TestApp<SchemaDef extends SchemaDefinition<any, boolean>, Components extends ComponentRegistrations = Record<never, never>> = {
    components: RegisteredComponents<Components>;
    query: QueryBuilder<DataModelFromSchemaDefinition<SchemaDef>, "public">;
    internalQuery: QueryBuilder<DataModelFromSchemaDefinition<SchemaDef>, "internal">;
    mutation: MutationBuilder<DataModelFromSchemaDefinition<SchemaDef>, "public">;
    internalMutation: MutationBuilder<DataModelFromSchemaDefinition<SchemaDef>, "internal">;
    action: ActionBuilder<DataModelFromSchemaDefinition<SchemaDef>, "public">;
    internalAction: ActionBuilder<DataModelFromSchemaDefinition<SchemaDef>, "internal">;
    defineModules<Modules extends Record<string, object>>(this: void, modules: Modules): TestAppDefinition<SchemaDef, Modules>;
};
export type TestAppDefinition<SchemaDef extends SchemaDefinition<any, boolean>, Modules extends Record<string, object>> = {
    api: FilterApi<ApiFromModules<Modules>, FunctionReference<any, "public">>;
    internal: FilterApi<ApiFromModules<Modules>, FunctionReference<any, "internal">>;
    createTest(this: void, options?: {
        transactionLimits?: Partial<TransactionMetrics> | boolean;
    }): TestConvex<SchemaDef>;
};
export declare function defineTestApp<SchemaDef extends SchemaDefinition<any, boolean>, Components extends ComponentRegistrations = Record<never, never>>({ schema, components, }: {
    schema: SchemaDef;
    components?: Components;
}): TestApp<SchemaDef, Components>;
export type TestConvexForDataModel<DataModel extends GenericDataModel> = {
    query: <QueryOrFunc extends FunctionReference<"query", any> | ((ctx: GenericQueryCtx<DataModel>) => Promise<any>)>(queryOrFunc: QueryOrFunc, ...args: QueryOrFunc extends FunctionReference<"query", any> ? OptionalRestArgs<QueryOrFunc> : []) => Promise<QueryOrFunc extends FunctionReference<"query", any> ? FunctionReturnType<QueryOrFunc> : QueryOrFunc extends (ctx: any) => Promise<infer Output> ? Output : never>;
    mutation: <MutationOrFunc extends FunctionReference<"mutation", any> | ((ctx: GenericMutationCtx<DataModel>) => Promise<any>)>(mutationOrFunc: MutationOrFunc, ...args: MutationOrFunc extends FunctionReference<"mutation", any> ? OptionalRestArgs<MutationOrFunc> : []) => Promise<MutationOrFunc extends FunctionReference<"mutation", any> ? FunctionReturnType<MutationOrFunc> : MutationOrFunc extends (ctx: any) => Promise<infer Output> ? Output : never>;
    action: <ActionOrFunc extends FunctionReference<"action", any> | ((ctx: GenericActionCtx<DataModel>) => Promise<any>)>(actionOrFunc: ActionOrFunc, ...args: ActionOrFunc extends FunctionReference<"action", any> ? OptionalRestArgs<ActionOrFunc> : []) => Promise<ActionOrFunc extends FunctionReference<"action", any> ? FunctionReturnType<ActionOrFunc> : ActionOrFunc extends (ctx: any) => Promise<infer Output> ? Output : never>;
    run: <Output>(func: (ctx: GenericMutationCtx<DataModel> & Pick<GenericActionCtx<DataModel>, "storage">) => Promise<Output>) => Promise<Output>;
    fetch(pathQueryFragment: string, init?: RequestInit): Promise<Response>;
    finishInProgressScheduledFunctions: () => Promise<void>;
    finishAllScheduledFunctions: (advanceTimers: () => void, maxIterations?: number) => Promise<void>;
    settleScheduledFunctions: (maxIterations?: number) => Promise<void>;
    withIdentity(identity: Partial<UserIdentity>): TestConvexForDataModel<DataModel>;
    withRequestMetadata(metadata: Partial<Pick<RequestMetadata, "ip" | "userAgent">>): TestConvexForDataModel<DataModel>;
};
export type TestConvexRoot<DataModel extends GenericDataModel> = {
    registerComponent: (componentPath: string, schema: SchemaDefinition<GenericSchema, boolean>, glob: Record<string, () => Promise<any>>) => void;
} & TestConvexForDataModel<DataModel>;
export type TestConvexForDataModelAndIdentity<DataModel extends GenericDataModel> = TestConvexRoot<DataModel>;
export declare function convexTest<Schema extends GenericSchema>(schema?: SchemaDefinition<Schema, boolean>, modules?: Record<string, () => Promise<any>>): TestConvex<SchemaDefinition<Schema, boolean>>;
export declare function convexTest<Schema extends GenericSchema>(options: {
    schema?: SchemaDefinition<Schema, boolean>;
    modules?: Record<string, () => Promise<any>>;
    transactionLimits?: Partial<TransactionMetrics> | boolean;
}): TestConvex<SchemaDefinition<Schema, boolean>>;
export {};
