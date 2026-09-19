#!/bin/sh
set -eu

# Xcode Cloud runs this from ios/App/ci_scripts — go to the repo root.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Node via Homebrew (Xcode Cloud images have brew available)
if ! command -v node > /dev/null 2>&1; then
  export HOMEBREW_NO_AUTO_UPDATE=1
  brew install node
fi

node -v
npm -v

npm ci --legacy-peer-deps --no-audit --no-fund
npm run build
npx cap sync ios

# Resolve Swift package dependencies so Package.resolved is in place before archiving
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
