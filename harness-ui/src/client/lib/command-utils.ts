/**
 * Slash Command Conversion Utilities
 *
 * Task 7.2: スラッシュコマンド変換方式の改善
 * - 既知コマンドのみを変換対象とする
 * - 絶対パスやURL等の誤爆を防止
 */

/**
 * Check if a string looks like an absolute path or URL (not a command)
 */
export function looksLikePathOrUrl(input: string): boolean {
  const trimmed = input.trim()

  // Absolute paths: /Users/..., /home/..., /etc/..., /var/...
  if (/^\/[a-zA-Z]+\//.test(trimmed)) {
    return true
  }

  // URLs with slashes: http://..., https://..., file://...
  if (/^[a-z]+:\/\//.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Extract command name from input (e.g., "/work arg" -> "work")
 */
export function extractCommandName(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  // Split by space and get the first part
  const parts = trimmed.split(/\s+/)
  const cmdPart = parts[0]
  if (!cmdPart || cmdPart.length <= 1) {
    return null
  }

  // Remove leading "/"
  return cmdPart.slice(1)
}

/**
 * Check if a command name is in the known commands list
 */
export function isKnownCommand(commandName: string, knownCommands: string[]): boolean {
  return knownCommands.includes(commandName)
}

/**
 * Convert slash command to natural language for SDK
 *
 * Only converts if:
 * 1. Input starts with "/"
 * 2. Not a path or URL
 * 3. Command name is in the known commands list
 *
 * @param input - User input string
 * @param knownCommands - List of known command names (without leading "/")
 * @returns Converted string or original input if not a valid command
 */
export function convertSlashCommand(input: string, knownCommands: string[]): string {
  const trimmed = input.trim()

  // Not a slash command
  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  // Looks like a path or URL - don't convert
  if (looksLikePathOrUrl(trimmed)) {
    return trimmed
  }

  // Extract command name
  const cmdName = extractCommandName(trimmed)
  if (!cmdName) {
    return trimmed
  }

  // Not a known command - don't convert
  if (!isKnownCommand(cmdName, knownCommands)) {
    return trimmed
  }

  // Convert known command to natural language
  const parts = trimmed.split(/\s+/)
  const args = parts.slice(1)

  if (args.length === 0) {
    // Single command without arguments
    return `${cmdName} を実行して`
  }

  // Command with arguments
  return `${cmdName} を実行して ${args.join(' ')}`
}
