require("dotenv").config();

const fs = require("fs");
const https = require("https");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const argv = yargs(hideBin(process.argv)).array("playlists").argv;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve(body));
      })
      .on("error", (err) => reject(err));
  });
}

function exportData(data) {
  return new Promise((resolve, reject) => {
    fs.writeFile("items.json", JSON.stringify(data), "utf8", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function getUrl(playlistId) {
  return `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${process.env.API_TOKEN}`;
}

async function getPlaylistItems(playlistId) {
  try {
    let lastPage = false;
    let nextPageToken;
    const items = [];
    while (lastPage === false) {
      const url = getUrl(playlistId);
      const res = await fetch(
        nextPageToken ? `${url}&pageToken=${nextPageToken}` : url
      );
      const data = JSON.parse(res);
      items.push(...data.items);
      if (data.nextPageToken === undefined) {
        lastPage = true;
      } else {
        nextPageToken = data.nextPageToken;
      }
    }
    const mappedItems = items.map((item) => {
      const {
        snippet: {
          title,
          description,
          publishedAt,
          resourceId: { videoId },
        },
      } = item;
      const href = `https://www.youtube.com/watch?v=${videoId}`;
      return { title, description, href, publishedAt };
    });
    return mappedItems;
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  try {
    const { playlists } = argv;
    if (process.env.API_TOKEN === undefined) {
      throw new Error("No API Token found!");
    }
    if (playlists === undefined) {
      throw new Error("No playlist ids found!");
    }
    const items = await playlists.reduce(async (promise, playlistId) => {
      const arr = await promise;
      const playlistItems = await getPlaylistItems(playlistId);
      return arr.concat(playlistItems);
    }, Promise.resolve([]));

    const sortedItems = items.sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );
    await exportData(sortedItems);
    console.info("Success");
  } catch (err) {
    console.error(err);
  }
}

main();
