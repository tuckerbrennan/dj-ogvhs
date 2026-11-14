#!/usr/bin/env bash
# Usage: OGVHS_AUDIO_BUCKET=... bash scripts/upload-exclusive-mixes-aws.sh <name> <source.wav>
# Names: brian-wilson-forever | amy-2-electric-boogaloo | tom-waits-forever
set -euo pipefail
export AWS_PAGER=""
if [[ $# -ne 2 ]]; then
  echo "Usage: OGVHS_AUDIO_BUCKET=... bash $0 <mix-name> <source.wav>" >&2
  exit 2
fi
mix="$1"; source="$2"
case "$mix" in
  brian-wilson-forever|amy-2-electric-boogaloo|tom-waits-forever) ;;
  *) echo "Unknown exclusive mix name" >&2; exit 2;;
esac
[[ -r "$source" ]] || { echo "File not readable: $source" >&2; exit 1; }
: "${OGVHS_AUDIO_BUCKET:?Set OGVHS_AUDIO_BUCKET to the dedicated OGVHS media bucket}"
command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
account="$(aws sts get-caller-identity --query Account --output text)"
[[ "$account" == "242088067567" ]] || { echo "Wrong AWS account: $account" >&2; exit 1; }
region="${OGVHS_REGION:-us-east-2}"
actual_region="$(aws s3api get-bucket-location --bucket "$OGVHS_AUDIO_BUCKET" --query LocationConstraint --output text)"
[[ "$actual_region" == "$region" ]] || { echo "Wrong bucket region: $actual_region; expected $region" >&2; exit 1; }
public_flags="$(aws s3api get-public-access-block --bucket "$OGVHS_AUDIO_BUCKET" --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' --output text)" ||
  { echo "Bucket public access block missing; aborting" >&2; exit 1; }
[[ "$(echo "$public_flags" | tr '\t' ' ' | xargs)" == "True True True True" ]] ||
  { echo "Bucket must block all public access; aborting" >&2; exit 1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
dest="$tmp/$mix.m4a"
ffmpeg -hide_banner -loglevel warning -nostdin -y -i "$source" \
  -map 0:a:0 -vn -c:a aac -b:a 192k -movflags +faststart "$dest"
[[ -s "$dest" ]] || { echo "Transcoding failed" >&2; exit 1; }
key="mixes/$mix.m4a"
aws s3 cp "$dest" "s3://$OGVHS_AUDIO_BUCKET/$key" --region "$region" \
  --content-type "audio/mp4" --cache-control "public,max-age=3600"
aws s3api head-object --bucket "$OGVHS_AUDIO_BUCKET" --key "$key" \
  --query '{Size:ContentLength,Type:ContentType,ETag:ETag}' --output json
echo "Uploaded privately to s3://$OGVHS_AUDIO_BUCKET/$key"
echo "Not published. Verify CloudFront playback before enabling the manifest entry."
