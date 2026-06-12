#!/usr/bin/env python3
"""Minimal JVM .class disassembler — enough to read obfuscated J2ME bytecode.
No JDK required. Usage: import and call dump(path) or grep helpers."""
import struct, sys

# opcode -> (mnemonic, operand_bytes)  (operand parsing for the subset we need)
OPS = {
0x00:('nop',0),0x01:('aconst_null',0),
0x02:('iconst_m1',0),0x03:('iconst_0',0),0x04:('iconst_1',0),0x05:('iconst_2',0),
0x06:('iconst_3',0),0x07:('iconst_4',0),0x08:('iconst_5',0),
0x09:('lconst_0',0),0x0a:('lconst_1',0),
0x0b:('fconst_0',0),0x0c:('fconst_1',0),0x0d:('fconst_2',0),
0x10:('bipush',1),0x11:('sipush',2),0x12:('ldc',1),0x13:('ldc_w',2),0x14:('ldc2_w',2),
0x15:('iload',1),0x16:('lload',1),0x17:('fload',1),0x19:('aload',1),
0x1a:('iload_0',0),0x1b:('iload_1',0),0x1c:('iload_2',0),0x1d:('iload_3',0),
0x1e:('lload_0',0),0x1f:('lload_1',0),0x20:('lload_2',0),0x21:('lload_3',0),
0x2a:('aload_0',0),0x2b:('aload_1',0),0x2c:('aload_2',0),0x2d:('aload_3',0),
0x2e:('iaload',0),0x2f:('laload',0),0x32:('aaload',0),0x33:('baload',0),0x34:('caload',0),0x35:('saload',0),
0x36:('istore',1),0x37:('lstore',1),0x3a:('astore',1),
0x3b:('istore_0',0),0x3c:('istore_1',0),0x3d:('istore_2',0),0x3e:('istore_3',0),
0x4b:('astore_0',0),0x4c:('astore_1',0),0x4d:('astore_2',0),0x4e:('astore_3',0),
0x4f:('iastore',0),0x50:('lastore',0),0x53:('aastore',0),0x54:('bastore',0),0x55:('castore',0),0x56:('sastore',0),
0x57:('pop',0),0x58:('pop2',0),0x59:('dup',0),0x5a:('dup_x1',0),0x5b:('dup_x2',0),0x5c:('dup2',0),
0x60:('iadd',0),0x61:('ladd',0),0x64:('isub',0),0x68:('imul',0),0x6c:('idiv',0),0x70:('irem',0),0x74:('ineg',0),
0x78:('ishl',0),0x7a:('ishr',0),0x7c:('iushr',0),0x7e:('iand',0),0x80:('ior',0),0x82:('ixor',0),
0x84:('iinc',2),
0x85:('i2l',0),0x86:('i2f',0),0x8b:('f2i',0),0x91:('i2b',0),0x92:('i2c',0),0x93:('i2s',0),
0x94:('lcmp',0),0x95:('fcmpl',0),0x96:('fcmpg',0),
0x99:('ifeq',2),0x9a:('ifne',2),0x9b:('iflt',2),0x9c:('ifge',2),0x9d:('ifgt',2),0x9e:('ifle',2),
0x9f:('if_icmpeq',2),0xa0:('if_icmpne',2),0xa1:('if_icmplt',2),0xa2:('if_icmpge',2),0xa3:('if_icmpgt',2),0xa4:('if_icmple',2),
0xa5:('if_acmpeq',2),0xa6:('if_acmpne',2),
0xa7:('goto',2),0xaa:('tableswitch',-1),0xab:('lookupswitch',-2),
0xac:('ireturn',0),0xad:('lreturn',0),0xb0:('areturn',0),0xb1:('return',0),
0xb2:('getstatic',2),0xb3:('putstatic',2),0xb4:('getfield',2),0xb5:('putfield',2),
0xb6:('invokevirtual',2),0xb7:('invokespecial',2),0xb8:('invokestatic',2),0xb9:('invokeinterface',4),
0xbb:('new',2),0xbc:('newarray',1),0xbd:('anewarray',2),0xbe:('arraylength',0),
0xbf:('athrow',0),0xc0:('checkcast',2),0xc1:('instanceof',2),0xc6:('ifnull',2),0xc7:('ifnonnull',2),
}

class Cls:
    def __init__(self, path):
        self.d = open(path,'rb').read()
        self.consts = {}
        self._parse()
    def _u2(self,p): return struct.unpack('>H',self.d[p:p+2])[0]
    def _u4(self,p): return struct.unpack('>I',self.d[p:p+4])[0]
    def _parse(self):
        d=self.d; p=8
        cnt=self._u2(p); p+=2; i=1
        while i<cnt:
            tag=d[p]; p+=1
            if tag==1:
                ln=self._u2(p); p+=2; self.consts[i]=('utf8',d[p:p+ln].decode('latin1')); p+=ln
            elif tag==3: self.consts[i]=('int',struct.unpack('>i',d[p:p+4])[0]); p+=4
            elif tag==4: self.consts[i]=('float',struct.unpack('>f',d[p:p+4])[0]); p+=4
            elif tag==5: self.consts[i]=('long',None); p+=8; i+=1
            elif tag==6: self.consts[i]=('double',None); p+=8; i+=1
            elif tag in (7,8,16): self.consts[i]=(('class','string','mtype')[(7,8,16).index(tag)],self._u2(p)); p+=2
            elif tag in (9,10,11): self.consts[i]=(('field','method','imethod')[(9,10,11).index(tag)],(self._u2(p),self._u2(p+2))); p+=4
            elif tag==12: self.consts[i]=('nt',(self._u2(p),self._u2(p+2))); p+=4
            elif tag in (17,18): self.consts[i]=('dyn',None); p+=4
            elif tag==15: self.consts[i]=('mh',None); p+=3
            elif tag==19 or tag==20: self.consts[i]=('mod',self._u2(p)); p+=2
            else: raise Exception('tag %d @%d'%(tag,p))
            i+=1
        self.access=self._u2(p); self.this=self._u2(p+2); self.sup=self._u2(p+4); p+=6
        nif=self._u2(p); p+=2+2*nif
        self.fields=[]
        nf=self._u2(p); p+=2
        for _ in range(nf):
            acc=self._u2(p); ni=self._u2(p+2); di=self._u2(p+4); p+=6
            na=self._u2(p); p+=2
            for _ in range(na):
                al=self._u4(p+2); p+=6+al
            self.fields.append((self.utf(ni),self.utf(di)))
        self.methods=[]
        nm=self._u2(p); p+=2
        for _ in range(nm):
            acc=self._u2(p); ni=self._u2(p+2); di=self._u2(p+4); p+=6
            na=self._u2(p); p+=2; code=None
            for _ in range(na):
                an=self._u2(p); al=self._u4(p+2); body=self.d[p+6:p+6+al]
                if self.utf(an)=='Code': code=body
                p+=6+al
            self.methods.append((self.utf(ni),self.utf(di),code))
    def utf(self,i):
        t=self.consts.get(i)
        return t[1] if t and t[0]=='utf8' else '#%d'%i
    def cname(self,i): # class const -> name
        return self.utf(self.consts[i][1])
    def ref(self,i): # field/method ref -> (class, name, type)
        t=self.consts[i]
        if t[0] in ('field','method','imethod'):
            ci,nti=t[1]; nt=self.consts[nti][1]
            return (self.cname(ci), self.utf(nt[0]), self.utf(nt[1]))
        if t[0]=='class': return (self.cname(i),'','')
        if t[0]=='string': return ('"'+self.utf(t[1])+'"','','')
        if t[0]=='int': return (str(t[1]),'','')
        return (str(t),'','')

def code_of(cls, mname):
    for n,d,c in cls.methods:
        if n==mname and c: return c
    return None

def disasm(cls, mname, mdesc=None):
    out=[]
    for n,d,c in cls.methods:
        if n!=mname or not c: continue
        if mdesc and d!=mdesc: continue
        ml=struct.unpack('>I',c[4:8])[0]; code=c[8:8+ml]
        out.append('=== %s%s ==='%(n,d))
        i=0
        while i<len(code):
            pc=i; op=code[i]; i+=1
            if op not in OPS: out.append('%4d: db 0x%02x'%(pc,op)); continue
            mn,nb=OPS[op]
            if nb==0: out.append('%4d: %s'%(pc,mn))
            elif nb==-1: # tableswitch
                pad=(4-(i%4))%4; i+=pad
                default=struct.unpack('>i',code[i:i+4])[0]; lo=struct.unpack('>i',code[i+4:i+8])[0]; hi=struct.unpack('>i',code[i+8:i+12])[0]
                i+=12; n2=hi-lo+1; i+=4*n2
                out.append('%4d: tableswitch lo=%d hi=%d default=+%d'%(pc,lo,hi,default))
            elif nb==-2:
                pad=(4-(i%4))%4; i+=pad
                default=struct.unpack('>i',code[i:i+4])[0]; npairs=struct.unpack('>i',code[i+4:i+8])[0]
                i+=8+8*npairs
                out.append('%4d: lookupswitch n=%d'%(pc,npairs))
            else:
                operand=code[i:i+nb];
                val=int.from_bytes(operand,'big',signed=(op in (0x10,0x11)))
                i+=nb
                ann=''
                if op in (0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xbb,0xbd,0xc0,0xc1,0x12,0x13):
                    try:
                        r=cls.ref(val); ann='  ; '+('%s.%s%s'%r if r[1] else r[0])
                    except Exception: pass
                out.append('%4d: %-14s %d%s'%(pc,mn,val,ann))
    return '\n'.join(out)

if __name__=='__main__':
    cls=Cls(sys.argv[1])
    print('CLASS',cls.cname(cls.this),'extends',cls.cname(cls.sup))
    print('FIELDS:',cls.fields)
    print('METHODS:',[(n,d) for n,d,c in cls.methods])
