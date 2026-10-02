import fs from 'fs';
import path from 'path';

const lockfilePath = path.resolve('package-lock.json');
if (!fs.existsSync(lockfilePath)) {
  console.log('package-lock.json not found');
  process.exit(0);
}

const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
const packages = lockfile.packages || {};

let addedCount = 0;

function fixAllOptionalDependencies() {
  for (const [pkgPath, pkgData] of Object.entries({ ...packages })) {
    const optionalDeps = pkgData.optionalDependencies || {};

    for (const [depName, depVersion] of Object.entries(optionalDeps)) {
      const cleanVersion = depVersion.replace(/^[\^~>=<|]+/, '').split(' ')[0] || '1.0.0';

      const targetPath = pkgPath ? `${pkgPath}/node_modules/${depName}` : `node_modules/${depName}`;

      if (!packages[targetPath]) {
        packages[targetPath] = {
          version: cleanVersion,
          optional: true,
        };
        addedCount++;
      }
    }
  }
}

fixAllOptionalDependencies();

if (addedCount > 0) {
  const sortedPackages = {};
  Object.keys(packages).sort().forEach(key => {
    sortedPackages[key] = packages[key];
  });
  lockfile.packages = sortedPackages;

  fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2) + '\n');
  console.log(`Successfully added ${addedCount} missing nested optional dependencies to package-lock.json!`);
} else {
  console.log('package-lock.json is fully synced!');
}
