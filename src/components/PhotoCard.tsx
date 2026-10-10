"use client";
import { date, time, type Photo } from "@/lib/model";
import { getPhoto } from "@/lib/persistence";
import { useEffect, useState } from "react";
export default function PhotoCard({
  photo,
  onDescription,
  disabled,
}: {
  photo: Photo;
  onDescription: (s: string) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState(photo.url);
  useEffect(() => {
    let objectURL = "";
    getPhoto(photo.id)
      .then((b) => {
        if (b) {
          objectURL = URL.createObjectURL(b);
          setUrl(objectURL);
        }
      })
      .catch(() => {});
    return () => {
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [photo.id]);
  return (
    <div className="photo-card">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={photo.description || photo.phase} />
        </a>
      ) : (
        <div className="photo-missing">ไม่พบไฟล์ในอุปกรณ์นี้</div>
      )}
      <div>
        <strong>{photo.phase}</strong>
        <small>
          {date(photo.at)} {time(photo.at)} · {photo.actor}
        </small>
        <small>
          GPS {photo.lat?.toFixed(6) || "ไม่ได้รับอนุญาต"}{" "}
          {photo.lng?.toFixed(6) || ""}
        </small>
        <input
          aria-label="คำอธิบายภาพ"
          defaultValue={photo.description}
          disabled={disabled}
          onBlur={(e) => {
            if (e.target.value !== photo.description)
              onDescription(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
