import { App, FrontMatterCache, TFile } from "obsidian";
import { stringifyIfObj, trancateString } from "./utils";

export type Properties = Record<string, unknown> | string | number | boolean | null | unknown[] | undefined;

export default class VaultProperties {
	private app: App;
	private properties: Properties;
	private localProperties: Properties;
	private localKeysAndAllVariableKeys: string[];
	private localKeys: string[];

	constructor(app: App) {
		this.app = app;
		this.updateVaultProperties();
		this.updateLocalKeysAndAllVariableKeys();
	}

	propertyChanged = (newProperties: FrontMatterCache | undefined) => {
		const localObj = this.localProperties !== null &&
			typeof this.localProperties === "object" &&
			!Array.isArray(this.localProperties)
			? this.localProperties
			: undefined;
		if (
			Object.entries(localObj ?? {}).length !==
			Object.entries(newProperties ?? {}).length
		) {
			return true;
		}
		for (const [newPropKey, newPropVal] of Object.entries(
			newProperties ?? {}
		)) {
			if (localObj) {
				const currentPropVal = localObj[newPropKey];
				if (
					JSON.stringify(currentPropVal) !==
					JSON.stringify(newPropVal)
				) {
					return true;
				}
			}
		}
		return false;
	};

	private updateVaultProperties() {
		this.properties = this.buildVaultTree();
	}

	updateProperties(file: TFile) {
		this.updateVaultProperties();
		this.localProperties = this.getValueByPath(this.properties, file.path);
		this.updateLocalKeysAndAllVariableKeys();
	}

	private buildVaultTree(): Properties {
		const tree: Properties = {};
		for (const file of this.app.vault.getMarkdownFiles()) {
			this.setAtPath(
				tree as Record<string, Properties>,
				file.path,
				this.getMarkdownProperties(file)
			);
		}
		return tree;
	}

	private setAtPath(
		obj: Record<string, Properties>,
		filePath: string,
		value: Properties
	) {
		const parts = filePath.split("/");
		let current = obj;
		for (let i = 0; i < parts.length - 1; i++) {
			if (
				typeof current[parts[i]] !== "object" ||
				current[parts[i]] === null
			) {
				current[parts[i]] = {};
			}
			current = current[parts[i]] as Record<string, Properties>;
		}
		current[parts[parts.length - 1]] = value;
	}

	private getMarkdownProperties(file: TFile): Properties {
		return this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	}

	getLocalProperty(key: string): Properties {
		return this.getLocalValueByPath(this.localProperties, key);
	}

	getProperty(path: string): Properties {
		return (
			this.getLocalProperty(path) ??
			this.getValueByPath(this.properties, path)
		);
	}

	getLocalProperties() {
		return this.localProperties;
	}

	private getValueByPath(obj: Properties, path: string): Properties {
		const isFolder = !path.contains(".md");
		const keys: string[] = [];
		if (isFolder) {
			keys.push(...path.split("/"));
		} else {
			const [fileTreePath, propertyPath] = path.split(".md");
			if (fileTreePath) keys.push(...(fileTreePath + ".md").split("/"));
			if (propertyPath) keys.push(...propertyPath.slice(1).split("."));
		}
		return this.traversePath(obj, keys) ?? {};
	}

	private traversePath(obj: Properties, keys: string[]) {
		let result: Properties = obj;
		for (const key of keys) {
			if (
				result !== null &&
				result !== undefined &&
				typeof result === "object" &&
				!Array.isArray(result) &&
				key in result
			) {
				result = (result as Record<string, Properties>)[key];
			} else {
				return undefined;
			}
		}
		return result;
	}

	private getLocalValueByPath(
		localProperties: Properties,
		path: string
	): Properties {
		const keys = path.split(".");
		return this.traversePath(localProperties, keys);
	}

	updateLocalKeysAndAllVariableKeys() {
		this.localKeys = this.getAllPaths(this.getLocalProperties(), "", true);
		this.localKeysAndAllVariableKeys = [
			...this.localKeys,
			...this.getAllPaths(this.properties),
		];
	}

	getLocalKeysAndAllVariableKeys() {
		return this.localKeysAndAllVariableKeys;
	}

	private getAllPaths(
		obj: Properties,
		parentPath = "",
		local?: boolean
	): string[] {
		const isNestedProperty = parentPath.contains(".md/") || local;
		const separator = isNestedProperty ? "." : "/";
		let paths: string[] = [];

		for (const [key, value] of Object.entries(obj ?? {})) {
			const fullPath = parentPath
				? `${parentPath}${separator}${key}`
				: key;

			paths.push(fullPath);

			if (value !== null && typeof value === "object") {
				paths = [...paths, ...this.getAllPaths(value as Properties, fullPath, local)];
			}
		}
		return paths;
	}

	getPropertyPreview(path: string) {
		const value = this.getProperty(path);
		return value ? trancateString(stringifyIfObj(value), 50) : "no value";
	}
}
