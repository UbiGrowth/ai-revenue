import simpleGit, { DiffResult } from 'simple-git';

const git = simpleGit();

interface ExecutionLog {
  timestamp: Date;
  message: string;
}

const logs: ExecutionLog[] = [];

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
    const diff: DiffResult = await git.diff(['--name-only']);
    
    // Problem 1: TS2367 - This expression is comparing DiffResult (object) to string
    // DiffResult is an object from simple-git, not a string
    if (diff !== "") {  // Line ~73 - TS2367 error
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
    // Problem 2: TS2345 - Argument type DiffResult (object) is not assignable 
    // to parameter type string | Buffer | Iterable<string | Buffer>
    process.stdout.write(diffResult);  // Line ~80 - TS2345 error
    
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
