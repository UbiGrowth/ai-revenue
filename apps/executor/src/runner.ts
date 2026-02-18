import simpleGit, { DiffResult } from 'simple-git';

const git = simpleGit();

interface ExecutionLog {
  timestamp: Date;
  message: string;
}

const logs: ExecutionLog[] = [];

// Helper function to convert any value to string for logging
function toText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function logMessage(msg: string): void {
  logs.push({
    timestamp: new Date(),
    message: msg,
  });
  console.log(msg);
}

async function checkForChanges(): Promise<boolean> {
  try {
    logMessage('Checking for code changes...');
    const diff: DiffResult = await git.diffSummary();
    
    // Fixed: Check for changes using the files array length or summary changes
    const hasChanges = Boolean(diff?.files?.length);
    
    if (hasChanges) {
      logMessage('Changes detected');
      return true;
    }
    
    logMessage('No changes detected');
    return false;
  } catch (error) {
    logMessage(`Error checking changes: ${error}`);
    return false;
  }
}

async function logDiffResults(): Promise<void> {
  try {
    const diffResult: DiffResult = await git.diffSummary();
    
    logMessage('Diff results:');
    // Fixed: Convert DiffResult object to string before writing to stdout
    process.stdout.write(toText(diffResult));
    
  } catch (error) {
    logMessage(`Error logging diff: ${error}`);
  }
}

async function run(): Promise<void> {
  logMessage('Starting executor...');
  
  const hasChanges = await checkForChanges();
  
  if (hasChanges) {
    await logDiffResults();
  }
  
  logMessage('Executor finished');
}

// Run the executor
run().catch(console.error);

export { checkForChanges, logDiffResults };
