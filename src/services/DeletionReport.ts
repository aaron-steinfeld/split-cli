import { ResourceType } from '../types/split';

interface DeletionResult {
  type: ResourceType;
  name: string;
  success: boolean;
  error?: string | undefined;
}

export class DeletionReport {
  private readonly results: DeletionResult[] = [];

  record(type: ResourceType, name: string, success: boolean, error?: string): void {
    this.results.push({ type, name, success, error });
  }

  get succeeded(): DeletionResult[] {
    return this.results.filter(r => r.success);
  }

  get failed(): DeletionResult[] {
    return this.results.filter(r => !r.success);
  }

  get hadFailures(): boolean {
    return this.failed.length > 0;
  }

  print(): void {
    const s = this.succeeded.length;
    const f = this.failed.length;

    if (f === 0) {
      console.log(`\nAll ${s} resource${s === 1 ? '' : 's'} deleted successfully.`);
      return;
    }

    console.log(`\nDeletion summary: ${s} succeeded, ${f} failed.`);
    console.log('  Failed:');
    for (const result of this.failed) {
      const detail = result.error ? ` (${result.error})` : '';
      console.log(`    ${result.type} '${result.name}'${detail}`);
    }
  }
}
