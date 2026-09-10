import type {
  BlockToolConstructor,
  BlockTool,
  BlockToolOptions,
  InlineToolConstructor,
  InlineTool,
  InlineToolOptions,
  BlockTuneConstructor,
  BlockTune,
  BlockTuneOptions,
  JsonObject,
  ToolDefinition,
  InlineToolDefinition,
  TuneDefinition,
  ToolboxConfig
} from "./types";
import { EzynotaError, toolNotFound } from "./errors";

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
export class ToolRegistry {
  private blockTools = new Map<string, RegisteredBlockTool>();
  private blockToolLoaders = new Map<string, () => Promise<void> | void>();
  private inlineTools: RegisteredInlineTool[] = [];
  private tunes: RegisteredTune[] = [];
  private defaultBlock = "paragraph";

  registerBlockTool(name: string, tool: BlockToolConstructor | ToolDefinition, isDefault = false): void {
    const def = normalizeBlockDefinition(tool);
    this.blockTools.set(name, {
      name,
      toolClass: def.cls,
      config: def.config ?? {},
      toolbox: def.cls.toolbox,
      shortcut: def.cls.shortcut ?? (tool as ToolDefinition).shortcut
    });
    if (isDefault) this.defaultBlock = name;
  }

  registerBlockToolLoader(name: string, loader: () => Promise<BlockToolConstructor>): void {
    this.blockToolLoaders.set(name, async () => {
      const cls = await loader();
      this.registerBlockTool(name, cls);
    });
  }

  async ensureLoaded(name: string): Promise<void> {
    const loader = this.blockToolLoaders.get(name);
    if (loader) {
      try {
        await loader();
      } catch (err) {
        throw new EzynotaError("EZ_TOOL_LOAD_FAILED", `Failed to load tool "${name}"`, { tool: name }, err);
      }
      this.blockToolLoaders.delete(name);
    }
  }

  has(name: string): boolean {
    return this.blockTools.has(name) || this.blockToolLoaders.has(name);
  }

  get(name: string): RegisteredBlockTool {
    const tool = this.blockTools.get(name);
    if (!tool) throw toolNotFound(name);
    return tool;
  }

  createBlockTool(name: string, options: BlockToolOptions): BlockTool {
    const reg = this.get(name);
    return new reg.toolClass({ ...options, config: { ...reg.config, ...options.config } });
  }

  listBlockTools(): RegisteredBlockTool[] {
    return Array.from(this.blockTools.values());
  }

  toolboxEntries(): RegisteredBlockTool[] {
    return this.listBlockTools().filter((t) => t.toolbox && t.name !== this.defaultBlock);
  }

  getDefaultBlock(): string {
    return this.defaultBlock;
  }

  setDefaultBlock(name: string): void {
    this.defaultBlock = name;
  }

  registerInlineTool(name: string, tool: InlineToolConstructor | InlineToolDefinition): void {
    const def = normalizeInlineDefinition(tool);
    this.inlineTools.push({ name, toolClass: def.cls, config: def.config ?? {} });
  }

  listInlineTools(): RegisteredInlineTool[] {
    return this.inlineTools;
  }

  createInlineTool(name: string, options: InlineToolOptions): InlineTool {
    const reg = this.inlineTools.find((t) => t.name === name);
    if (!reg) throw toolNotFound(name);
    return new reg.toolClass({ ...options, config: { ...reg.config, ...options.config } });
  }

  registerTune(name: string, tune: BlockTuneConstructor | TuneDefinition): void {
    const def = normalizeTuneDefinition(tune);
    this.tunes.push({ name, toolClass: def.cls, config: def.config ?? {} });
  }

  listTunes(): RegisteredTune[] {
    return this.tunes;
  }

  createTune(name: string, options: BlockTuneOptions): BlockTune {
    const reg = this.tunes.find((t) => t.name === name);
    if (!reg) throw toolNotFound(name);
    return new reg.toolClass({ ...options, config: { ...reg.config, ...options.config } });
  }
}

function normalizeBlockDefinition(tool: BlockToolConstructor | ToolDefinition): { cls: BlockToolConstructor; config?: JsonObject; shortcut?: string } {
  if (typeof tool === "function") return { cls: tool as BlockToolConstructor, config: undefined };
  const def = tool as ToolDefinition;
  if (!def || typeof def.class !== "function") {
    throw new EzynotaError("EZ_TOOL_LOAD_FAILED", "Tool definition must be a class or { class, config }");
  }
  return { cls: def.class as BlockToolConstructor, config: def.config, shortcut: def.shortcut };
}

function normalizeInlineDefinition(tool: InlineToolConstructor | InlineToolDefinition): { cls: InlineToolConstructor; config?: JsonObject } {
  if (typeof tool === "function") return { cls: tool as InlineToolConstructor, config: undefined };
  if (!tool || typeof tool.class !== "function") {
    throw new EzynotaError("EZ_TOOL_LOAD_FAILED", "Inline tool definition must be a class or { class, config }");
  }
  return { cls: tool.class, config: tool.config };
}

function normalizeTuneDefinition(tune: BlockTuneConstructor | TuneDefinition): { cls: BlockTuneConstructor; config?: JsonObject } {
  if (typeof tune === "function") return { cls: tune as BlockTuneConstructor, config: undefined };
  if (!tune || typeof tune.class !== "function") {
    throw new EzynotaError("EZ_TOOL_LOAD_FAILED", "Tune definition must be a class or { class, config }");
  }
  return { cls: tune.class, config: tune.config };
}
