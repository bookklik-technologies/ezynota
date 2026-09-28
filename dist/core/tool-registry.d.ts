import type { BlockToolConstructor, BlockTool, BlockToolOptions, InlineToolConstructor, InlineTool, InlineToolOptions, BlockTuneConstructor, BlockTune, BlockTuneOptions, JsonObject, ToolDefinition, InlineToolDefinition, TuneDefinition, ToolboxConfig } from "./types";
export interface RegisteredBlockTool {
    name: string;
    toolClass: BlockToolConstructor;
    config: JsonObject;
    toolbox?: ToolboxConfig;
    shortcut?: string;
}
export interface RegisteredInlineTool {
    name: string;
    toolClass: InlineToolConstructor;
    config: JsonObject;
}
export interface RegisteredTune {
    name: string;
    toolClass: BlockTuneConstructor;
    config: JsonObject;
}
/**
 * ToolRegistry holds block tools, inline tools and block tunes.
 * Tool classes may be provided directly or as { class, config } definitions.
 * Lazy loading: `registerLoader` accepts a factory invoked on first use.
 */
export declare class ToolRegistry {
    private blockTools;
    private blockToolLoaders;
    private inlineTools;
    private tunes;
    private defaultBlock;
    registerBlockTool(name: string, tool: BlockToolConstructor | ToolDefinition, isDefault?: boolean): void;
    registerBlockToolLoader(name: string, loader: () => Promise<BlockToolConstructor>): void;
    ensureLoaded(name: string): Promise<void>;
    /**
     * Whether the tool CLASS is currently registered (matches get()).
     * Loader-only registrations are NOT reflected here — use isLoadable()
     * when a lazy loader should also count.
     */
    has(name: string): boolean;
    /** Whether a lazy loader is registered for this tool but not yet run. */
    hasLoader(name: string): boolean;
    /** Whether the tool is loaded OR loadable via a registered lazy loader. */
    isLoadable(name: string): boolean;
    /**
     * The registered tool class. Throws EZ_TOOL_NOT_FOUND when only a lazy
     * loader is registered — call ensureLoaded(name) first (see isLoadable).
     */
    get(name: string): RegisteredBlockTool;
    createBlockTool(name: string, options: BlockToolOptions): BlockTool;
    listBlockTools(): RegisteredBlockTool[];
    toolboxEntries(): RegisteredBlockTool[];
    getDefaultBlock(): string;
    setDefaultBlock(name: string): void;
    registerInlineTool(name: string, tool: InlineToolConstructor | InlineToolDefinition): void;
    listInlineTools(): RegisteredInlineTool[];
    createInlineTool(name: string, options: InlineToolOptions): InlineTool;
    registerTune(name: string, tune: BlockTuneConstructor | TuneDefinition): void;
    listTunes(): RegisteredTune[];
    createTune(name: string, options: BlockTuneOptions): BlockTune;
}
