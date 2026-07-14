import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FIVE_MINUTES_IN_SECONDS } from "@/utils/constants";
import { env } from "./env";

export const BUCKET = env.R2_BUCKET_NAME;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const getPresignedUploadUrl = ({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}): Promise<string> => {
  console.log("getPresignedUploadUrl", key, contentType, r2);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: FIVE_MINUTES_IN_SECONDS });
};

export const deleteObject = (key: string): Promise<unknown> => {
  return r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

/** Stable, cacheable public URL for an object (requires a public R2 bucket/domain). */
export const getPublicUrl = (key: string): string => {
  return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
};
