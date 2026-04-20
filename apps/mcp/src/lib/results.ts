export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function textResult(text: string, options?: { isError?: boolean }) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    ...(options?.isError ? { isError: true as const } : {}),
  };
}

export function jsonResult<T>(value: T, summary?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: summary
          ? `${summary}\n\n${formatJson(value)}`
          : formatJson(value),
      },
    ],
    structuredContent: value,
  };
}

export function jsonResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: formatJson(value),
      },
    ],
  };
}
