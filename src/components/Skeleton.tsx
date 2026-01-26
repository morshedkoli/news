import React from "react";
import styles from "./Skeleton.module.css";

export default function Skeleton({ height = 20, width = "100%", borderRadius = 4 }) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius }}
      aria-busy="true"
      aria-label="Loading..."
    />
  );
}
