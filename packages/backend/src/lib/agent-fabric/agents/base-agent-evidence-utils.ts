export function extractNumericPaths(obj: unknown, path = ''): string[] {
  const paths: string[] = [];

  if (typeof obj === 'number') {
    return [path];
  }

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      paths.push(...extractNumericPaths(value, currentPath));
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const currentPath = path ? `${path}[${i}]` : `[${i}]`;
      paths.push(...extractNumericPaths(obj[i], currentPath));
    }
  }

  return paths;
}
