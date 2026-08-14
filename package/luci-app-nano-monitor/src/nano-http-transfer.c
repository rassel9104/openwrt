// SPDX-License-Identifier: MIT
// Copyright (C) 2026 RaykTo <raktodev@gmail.com>

#include <curl/curl.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

static size_t discard_body(char *buffer, size_t size, size_t count, void *data)
{
	(void)buffer;
	(void)data;
	return size * count;
}

int main(int argc, char **argv)
{
	CURL *curl = NULL;
	CURLcode result;
	FILE *upload = NULL;
	struct stat info;
	char error[CURL_ERROR_SIZE] = { 0 };
	curl_off_t transferred = 0;
	curl_off_t elapsed_us = 0;
	int post;
	int status = 1;

	if (argc < 3 || argc > 4 ||
	    (strcmp(argv[1], "get") != 0 && strcmp(argv[1], "post") != 0)) {
		fprintf(stderr, "usage: %s get URL | post URL FILE\n", argv[0]);
		return 2;
	}

	post = strcmp(argv[1], "post") == 0;
	if ((post && argc != 4) || (!post && argc != 3))
		return 2;

	if (post) {
		upload = fopen(argv[3], "rb");
		if (upload == NULL || fstat(fileno(upload), &info) != 0) {
			fprintf(stderr, "unable to read upload payload\n");
			goto cleanup;
		}
	}

	if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK)
		goto cleanup;

	curl = curl_easy_init();
	if (curl == NULL)
		goto cleanup_global;

	curl_easy_setopt(curl, CURLOPT_URL, argv[2]);
	curl_easy_setopt(curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
	curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, 90L);
	curl_easy_setopt(curl, CURLOPT_FAILONERROR, 1L);
	curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
	curl_easy_setopt(curl, CURLOPT_USERAGENT, "NanoMonitor/1.1");
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discard_body);
	curl_easy_setopt(curl, CURLOPT_ERRORBUFFER, error);

	if (post) {
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_READDATA, upload);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE_LARGE, (curl_off_t)info.st_size);
	}

	result = curl_easy_perform(curl);
	if (result == CURLE_OK) {
		curl_easy_getinfo(curl, post ? CURLINFO_SIZE_UPLOAD_T : CURLINFO_SIZE_DOWNLOAD_T,
		                  &transferred);
		curl_easy_getinfo(curl, CURLINFO_TOTAL_TIME_T, &elapsed_us);
		printf("%" CURL_FORMAT_CURL_OFF_T " %" CURL_FORMAT_CURL_OFF_T "\n",
		       transferred, elapsed_us);
		status = 0;
	}
	else
		fprintf(stderr, "%s\n", error[0] ? error : curl_easy_strerror(result));

	curl_easy_cleanup(curl);
cleanup_global:
	curl_global_cleanup();
cleanup:
	if (upload != NULL)
		fclose(upload);
	return status;
}
