%.o: %.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(FPIC) -Wall -Wextra -c -o $@ $<

clean:
	rm -f nano-http-transfer *.o

nano-http-transfer: nano-http-transfer.o
	$(CC) $(LDFLAGS) -o $@ $^ -lcurl

compile: nano-http-transfer

install: compile
	mkdir -p $(DESTDIR)/usr/bin
	cp nano-http-transfer $(DESTDIR)/usr/bin/nano-http-transfer
