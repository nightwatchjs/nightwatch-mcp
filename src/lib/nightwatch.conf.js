module.exports = {
    src_folders: ["tests"],
    webdriver: {
        start_process: true,
        server_path: "",
    },
    test_settings: {
        default: {
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["--headless", "--disable-gpu", "--no-sandbox"],
                },
            },
        },
    },
};
