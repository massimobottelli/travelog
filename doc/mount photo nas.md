apt update && apt install nfs-common
mkdir -p /mnt/nas
mount -t nfs 192.168.1.122:/volume1/homes /mnt/nas
ls -la /mnt/nas
nano /etc/fstab
	192.168.1.122:/volume1/homes /mnt/nas nfs defaults, netdev 0 0
mount -a
pct set 113 -mp0 /mnt/nas,mp=/mnt/nas
