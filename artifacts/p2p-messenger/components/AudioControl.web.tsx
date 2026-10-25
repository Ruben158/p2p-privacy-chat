import React from 'react';

export default function AudioControl({
  data,
  mimeType,
}: {
  data: string;
  mimeType: string;
}) {
  return React.createElement('audio', {
    controls: true,
    preload: 'metadata',
    src: `data:${mimeType};base64,${data}`,
    style: { display: 'block', width: 'min(270px, 70vw)', height: 42 },
  });
}
