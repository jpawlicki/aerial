#!/bin/bash
(find . -not -path '*/.*' -type d | sed 's/.*/mkdir pawlicki.kaelri.com\/aerial\/\0\nchmod 755 pawlicki.kaelri.com\/aerial\/\0/'; ./list_upload_files.sh | sed 's/.*/put \0 pawlicki.kaelri.com\/aerial\/\0\nchmod 0644 pawlicki.kaelri.com\/aerial\/\0/') | sftp jpawlick@ps561277.dreamhostps.com
