/**
 * Simplified minimist implementation for parsing command line arguments
 */

interface ParsedArgs {
  _: string[];
  [key: string]: any;
}

export function minimist(args: string[]): ParsedArgs {
  const result: ParsedArgs = { _: [] };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const equalIndex = key.indexOf('=');
      
      if (equalIndex > -1) {
        // --key=value format
        const actualKey = key.slice(0, equalIndex);
        const value = key.slice(equalIndex + 1);
        result[actualKey] = parseValue(value);
      } else {
        // --key value format
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          result[key] = parseValue(nextArg);
          i++;
        } else {
          result[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Short flag like -v
      const flags = arg.slice(1).split('');
      for (const flag of flags) {
        result[flag] = true;
      }
    } else {
      // Positional argument
      result._.push(arg);
    }
    
    i++;
  }
  
  return result;
}

function parseValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num)) return num;
  
  return value;
}
