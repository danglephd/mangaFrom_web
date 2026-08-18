#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "ERROR: Missing parameters."
  echo "Usage: ./deploy-child.sh <ten_project> <folder> <service_account_json>"
  echo "Example: ./deploy-child.sh proj-eor eor firebase-danglephd.iptp.test.json"
  exit 1
fi

TEN_PROJECT="$1"
SOURCE_FOLDER="$2"
SERVICE_ACCOUNT_PATH="$3"
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
SERVICE_ACCOUNT="$SCRIPT_DIR/firebase/$SERVICE_ACCOUNT_PATH"
SOURCE_DIR="$SCRIPT_DIR/downloads/$SOURCE_FOLDER"
TEMPLATE_DIR="$SCRIPT_DIR/finished/proj-temp"
TARGET_DIR="$SCRIPT_DIR/finished/$TEN_PROJECT"
TARGET_PUBLIC="$TARGET_DIR/public"

if [[ "$TEN_PROJECT" == *" "* ]]; then
  echo "ERROR: ten_project must not contain spaces."
  exit 1
fi

if [ ! -f "$SERVICE_ACCOUNT" ]; then
  echo "ERROR: Service Account not found: $SERVICE_ACCOUNT"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Source folder not found: $SOURCE_DIR"
  exit 1
fi

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "ERROR: Project template not found: $TEMPLATE_DIR"
  exit 1
fi

if [ -d "$TARGET_DIR" ]; then
  echo "WARN: Target project already exists: $TARGET_DIR"
  rm -rf "$TARGET_DIR"
fi

if command -v fnm >/dev/null 2>&1; then
  fnm use 22
else
  echo "WARN: fnm not found in PATH; assuming Node.js 22 is already active."
fi

cp -R "$TEMPLATE_DIR" "$TARGET_DIR"
mkdir -p "$TARGET_PUBLIC"
cp -R "$SOURCE_DIR"/. "$TARGET_PUBLIC/"

PACKAGE_JSON="$TARGET_DIR/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  node -e "const fs=require('fs'); const p='$PACKAGE_JSON'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.name=process.argv[1]; fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');" "$TEN_PROJECT"
fi

FIREBASE_RC="$TARGET_DIR/.firebaserc"
if [ -f "$FIREBASE_RC" ]; then
  node -e "const fs=require('fs'); const p='$FIREBASE_RC'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.projects=j.projects||{}; j.projects.default=process.argv[1]; fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');" "$TEN_PROJECT"
fi

export GOOGLE_APPLICATION_CREDENTIALS="$SERVICE_ACCOUNT"

cd "$TARGET_DIR"
node scripts/generate.js
yarn build
firebase deploy

echo "============================================================"
echo "DEPLOY SUCCESS"
echo "============================================================"
echo "Project: $TEN_PROJECT"
echo "URL: https://${TEN_PROJECT,,}.web.app/"
echo "============================================================"
