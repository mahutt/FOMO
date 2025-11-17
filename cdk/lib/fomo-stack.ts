import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3assets from 'aws-cdk-lib/aws-s3-assets'
import * as path from 'path'

export class FomoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Use the default VPC if it exists; otherwise create a new one
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: true })

    // Security group allowing inbound HTTP on port 8000 from anywhere (demo/simple)
    const sg = new ec2.SecurityGroup(this, 'FastApiSg', {
      vpc,
      description: 'Allow inbound HTTP traffic to FastAPI on 8000',
      allowAllOutbound: true,
    })
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      'HTTP for FastAPI'
    )

    // Instance role with SSM for secure access (no SSH needed)
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'EC2 instance role with SSM access and S3 read for assets',
    })
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    )

    // ARM64 Amazon Linux 2 for t4g
    const ami = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      edition: ec2.AmazonLinuxEdition.STANDARD,
    })

    // Bundle the server/ folder as an asset
    const serverPath = path.join(__dirname, '..', '..', 'server')
    const serverAsset = new s3assets.Asset(this, 'ServerCodeAsset', {
      path: serverPath,
      exclude: ['venv', 'venv/**', '__pycache__', '**/__pycache__', '*.pyc'],
    })

    // User data script to configure Python, install deps, and run FastAPI with systemd
    const userData = ec2.UserData.forLinux()
    userData.addCommands(
      'set -euxo pipefail',
      'yum update -y',
      'yum install -y python3.11 python3.11-pip',
      // Install supporting tools
      'yum install -y unzip awscli',
      'mkdir -p /opt/server && cd /opt/server',
      // Download and extract asset
      `aws s3 cp s3://${serverAsset.s3BucketName}/${serverAsset.s3ObjectKey} /opt/server/server.zip`,
      'unzip -o /opt/server/server.zip -d /opt/server',
      'rm -f /opt/server/server.zip',
      'python3.11 -m venv /opt/server/venv',
      'source /opt/server/venv/bin/activate',
      'pip install --upgrade pip',
      'pip install fastapi uvicorn',
      // Create systemd service
      'cat > /etc/systemd/system/fastapi.service << "EOF"',
      '[Unit]',
      'Description=FastAPI Service',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'WorkingDirectory=/opt/server',
      'Environment=PATH=/opt/server/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      'ExecStart=/opt/server/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000',
      'Restart=always',
      'RestartSec=3',
      'User=ec2-user',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      'systemctl daemon-reload',
      'systemctl enable fastapi.service',
      'systemctl start fastapi.service'
    )

    const instance = new ec2.Instance(this, 'FastApiInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: sg,
      instanceType: new ec2.InstanceType('t4g.nano'),
      machineImage: ami,
      role,
      userData,
      associatePublicIpAddress: true,
      ssmSessionPermissions: true,
    })

    // Grant the instance permission to read the asset from S3
    serverAsset.grantRead(instance.role)

    new cdk.CfnOutput(this, 'InstancePublicDns', {
      value: instance.instancePublicDnsName,
      description: 'Public DNS of the FastAPI EC2 instance',
    })

    new cdk.CfnOutput(this, 'FastApiUrl', {
      value: cdk.Fn.join('', [
        'http://',
        instance.instancePublicDnsName,
        ':8000/',
      ]),
      description: 'URL to reach the FastAPI app',
    })
  }
}
