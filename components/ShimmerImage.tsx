"use client";

import React, { useState } from "react";
import Image, { type ImageProps } from "next/image";

export default function ShimmerImage(props: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative h-full w-full overflow-hidden ${!isLoaded ? "skeleton" : ""}`}>
      <Image
        {...props}
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${props.className || ""}`}
        onLoad={(e) => {
          setIsLoaded(true);
          if (props.onLoad) {
            // @ts-ignore
            props.onLoad(e);
          }
        }}
      />
    </div>
  );
}
