import React from "react";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export default function Skeleton({ height = 20, width = "100%", borderRadius = 4, className }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className || ""}`}
      style={{ height, width, borderRadius }}
      aria-busy="true"
      aria-label="Loading..."
    />
  );
}
