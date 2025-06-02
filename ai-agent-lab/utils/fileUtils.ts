
export const readJsonFile = <T,>(file: File): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target && typeof event.target.result === 'string') {
          const json = JSON.parse(event.target.result);
          resolve(json as T);
        } else {
          reject(new Error('Failed to read file content.'));
        }
      } catch (error) {
        reject(new Error(`Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    };
    reader.onerror = (error) => {
      reject(new Error(`File reading error: ${error}`));
    };
    reader.readAsText(file);
  });
};

export const downloadJsonFile = (data: any, filename: string): void => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
